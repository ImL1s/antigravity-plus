/**
 * Antigravity Plus - 主入口點
 * 
 * 整合競品最佳實作：
 * - 200ms 輪詢引擎 (Auto Accept Agent)
 * - GetUserStatus API (AntigravityQuotaWatcher)
 * - Circuit Breaker (Yoke AntiGravity)
 * - 分組功能 (Antigravity Cockpit)
 * - Impact Dashboard (Auto Accept PRO)
 * - Performance Mode
 * - Auto Wake-up
 * - 多語系支援 (8 種語言)
 */

import * as vscode from 'vscode';
import { AutoApproveController } from './core/auto-approve/controller';
import { QuotaMonitorController } from './core/quota-monitor/controller';
import { ImpactTracker } from './core/auto-approve/impact-tracker';
import { PerformanceModeController } from './core/auto-approve/performance-mode';
import { AutoWakeupController } from './core/auto-wakeup/controller';
import { StatusBarManager } from './ui/status-bar';
import { DashboardPanel } from './ui/dashboard';
import { Logger } from './utils/logger';
import { ConfigManager } from './utils/config';
import { initI18n, updateLocale, t } from './i18n';

// 全域實例
let autoApproveController: AutoApproveController | undefined;
let quotaMonitorController: QuotaMonitorController | undefined;
let impactTracker: ImpactTracker | undefined;
let performanceMode: PerformanceModeController | undefined;
let wakeupController: AutoWakeupController | undefined;
let statusBarManager: StatusBarManager | undefined;
let logger: Logger | undefined;
let configManager: ConfigManager | undefined;

/**
 * 擴展啟動
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
    console.log('Antigravity Plus is now active!');

    // 初始化 i18n
    initI18n();

    // 初始化工具
    logger = new Logger();
    configManager = new ConfigManager();

    // 初始化 Impact & Performance
    impactTracker = new ImpactTracker(context);
    performanceMode = new PerformanceModeController(context);

    // 初始化 UI
    statusBarManager = new StatusBarManager(context);

    // 初始化控制器
    autoApproveController = new AutoApproveController(context, logger, configManager);
    quotaMonitorController = new QuotaMonitorController(context, logger, configManager, statusBarManager);
    wakeupController = new AutoWakeupController(context, logger);

    // 開始新 session
    impactTracker.startSession();

    // 監聽 Performance Mode 變更
    performanceMode.onChange((interval) => {
        autoApproveController?.setPollingInterval(interval);
    });

    // 註冊指令
    registerCommands(context);

    // 監聽設定變更
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('antigravity-plus')) {
                configManager?.reload();

                // 更新語言
                if (e.affectsConfiguration('antigravity-plus.ui.language')) {
                    updateLocale();
                    statusBarManager?.refresh();
                }

                autoApproveController?.updateConfig();
                quotaMonitorController?.updateConfig();
                statusBarManager?.updateConfig();
            }
        })
    );

    // 啟動服務（使用修正後的 API 連接方式）
    // Quota Monitor 已修正：使用 HTTPS + X-Codeium-Csrf-Token
    // 注意：使用 setImmediate 避免阻塞擴充功能啟動
    if (configManager.get<boolean>('quotaMonitor.enabled')) {
        setImmediate(() => {
            quotaMonitorController?.start().catch(err => {
                logger?.error(`QuotaMonitor start error: ${err}`);
            });
        });
    }

    // Enable Auto Approve (Using Pesosz Command Strategy)
    autoApproveController.enable();

    // Start Auto Wakeup (Using Cloud API)
    // wakeupController.start();

    logger.info('Antigravity Plus 已啟動');
}

/**
 * 註冊所有指令
 */
function registerCommands(context: vscode.ExtensionContext): void {
    // 開啟 Dashboard
    context.subscriptions.push(
        vscode.commands.registerCommand('antigravity-plus.openDashboard', () => {
            DashboardPanel.createOrShow(
                context.extensionUri,
                impactTracker!,
                performanceMode!,
                wakeupController!,
                autoApproveController?.isEnabled() ?? false
            );
        })
    );

    // 切換自動核准
    context.subscriptions.push(
        vscode.commands.registerCommand('antigravity-plus.toggleAutoApprove', () => {
            const newState = autoApproveController?.toggle();
            const message = newState
                ? t('notifications.autoApprove.enabled')
                : t('notifications.autoApprove.disabled');
            vscode.window.showInformationMessage(message);
            statusBarManager?.updateAutoApproveState(newState ?? false);

            // 更新 Dashboard
            DashboardPanel.currentPanel?.updateAutoApproveState(newState ?? false);
        })
    );

    // 刷新配額
    context.subscriptions.push(
        vscode.commands.registerCommand('antigravity-plus.refreshQuota', async () => {
            await quotaMonitorController?.refresh();
            vscode.window.showInformationMessage(t('notifications.quota.refreshed'));
        })
    );

    // 重置 Session
    context.subscriptions.push(
        vscode.commands.registerCommand('antigravity-plus.resetSession', () => {
            quotaMonitorController?.resetSession();
            impactTracker?.startSession();
            vscode.window.showInformationMessage(t('notifications.session.reset'));
        })
    );

    // 顯示操作日誌
    context.subscriptions.push(
        vscode.commands.registerCommand('antigravity-plus.showLogs', () => {
            logger?.showOutputChannel();
        })
    );

    // QuickPick 備用模式
    context.subscriptions.push(
        vscode.commands.registerCommand('antigravity-plus.showQuickPick', async () => {
            const data = quotaMonitorController?.getQuotaData();
            if (!data) {
                vscode.window.showWarningMessage(t('statusBar.quota.noData'));
                return;
            }

            const items = data.models.map(model => ({
                label: `${getStatusIcon(100 - model.percentage)} ${model.displayName}`,
                description: `${100 - model.percentage}% ${t('dashboard.quota.remaining')}`,
                detail: model.resetTime
                    ? `${t('dashboard.quota.resetAt')}: ${model.resetTime.toLocaleTimeString()}`
                    : undefined
            }));

            await vscode.window.showQuickPick(items, {
                title: t('dashboard.quota.title'),
                placeHolder: t('dashboard.quota.refresh')
            });
        })
    );

    // 測試 Auto Wake-up
    context.subscriptions.push(
        vscode.commands.registerCommand('antigravity-plus.testWakeup', async () => {
            await wakeupController?.testNow();
            vscode.window.showInformationMessage('Auto Wake-up 測試已執行');
        })
    );
}

/**
 * 取得狀態圖示
 */
function getStatusIcon(percent: number): string {
    if (percent >= 50) return '🟢';
    if (percent >= 20) return '🟡';
    return '🔴';
}

/**
 * 擴展停用
 */
export function deactivate(): void {
    console.log('Antigravity Plus is now deactivated!');

    impactTracker?.endSession();
    autoApproveController?.dispose();
    quotaMonitorController?.dispose();
    wakeupController?.dispose();
    impactTracker?.dispose();
    performanceMode?.dispose();
    statusBarManager?.dispose();
    logger?.dispose();
}
