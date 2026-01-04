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
    console.log('[DEBUG] Antigravity Plus: activate() started');
    try {

        // 初始化 i18n
        initI18n();

        // 初始化工具
        logger = new Logger();
        configManager = new ConfigManager();

        // 初始化 Impact & Performance
        impactTracker = new ImpactTracker(context);
        performanceMode = new PerformanceModeController(context);

        console.log('[DEBUG] Antigravity Plus: Basic tools initialized');
        // 初始化 UI
        statusBarManager = new StatusBarManager(context);
        console.log('[DEBUG] Antigravity Plus: StatusBarManager initialized');

        // 初始化控制器
        autoApproveController = new AutoApproveController(context, logger, configManager);
        console.log('[DEBUG] Antigravity Plus: AutoApproveController initialized');
        quotaMonitorController = new QuotaMonitorController(context, logger, configManager, statusBarManager);
        console.log('[DEBUG] Antigravity Plus: QuotaMonitorController initialized');

        // 4. 初始化自動喚醒控制器
        // Inject StatusBarManager for UI updates
        const wakeupController = new AutoWakeupController(context, logger, quotaMonitorController, statusBarManager);
        context.subscriptions.push(wakeupController);

        // 啟動自動喚醒 (如果已啟用)
        wakeupController.start().catch(err => {
            logger?.error(`自動喚醒啟動失敗: ${err}`);
        });
        console.log('[DEBUG] Antigravity Plus: AutoWakeupController initialized');

        // 開始新 session
        impactTracker.startSession();

        // 監聽 Performance Mode 變更
        performanceMode.onChange((interval) => {
            autoApproveController?.setPollingInterval(interval);
        });

        // 註冊指令
        console.log('[DEBUG] Antigravity Plus: Registering commands...');
        registerCommands(context);
        console.log('[DEBUG] Antigravity Plus: Commands registered');

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
        console.log('[DEBUG] Antigravity Plus: activate() finished');
    } catch (error) {
        console.error('[ERROR] Antigravity Plus: Activation failed!', error);
        throw error;
    }
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

    // Show Auto Approve Config Menu
    context.subscriptions.push(
        vscode.commands.registerCommand('antigravity-plus.showAutoApproveMenu', async () => {
            const isEnabled = autoApproveController?.isEnabled();
            const currentStrategy = configManager?.get<string>('autoApprove.strategy') || 'pesosz';
            const currentInterval = configManager?.get<number>('autoApprove.interval') || 200;

            const items: vscode.QuickPickItem[] = [
                {
                    label: isEnabled ? '$(circle-slash) Disable Auto Accept' : '$(check) Enable Auto Accept',
                    description: isEnabled ? 'Currently ON' : 'Currently OFF',
                    detail: 'Main toggle for all auto-approval features'
                },
                {
                    label: '$(gear) Configure Strategy',
                    description: `Current: ${currentStrategy}`,
                    detail: 'Select approval strategy (Pesosz / Native / CDP)'
                },
                {
                    label: '$(watch) Polling Interval',
                    description: `Current: ${currentInterval}ms`,
                    detail: 'Adjust how often to check for requests'
                },
                {
                    label: '$(settings) Open Extension Settings',
                    detail: 'View all configuration options'
                }
            ];

            const selection = await vscode.window.showQuickPick(items, {
                placeHolder: 'Auto Accept Configuration',
                title: 'Antigravity Plus'
            });

            if (!selection) return;

            if (selection.label.includes('Enable') || selection.label.includes('Disable')) {
                // Toggle
                vscode.commands.executeCommand('antigravity-plus.toggleAutoApprove');

            } else if (selection.label.includes('Strategy')) {
                // Change Strategy
                const strategies = [
                    { label: 'pesosz', description: 'Simulate internal commands (Recommended)', detail: 'Directly accepts agent requests' },
                    { label: 'native', description: 'VS Code Inline Suggest', detail: 'Uses editor.action.inlineSuggest.commit' },
                    { label: 'cdp', description: 'Chrome DevTools Protocol', detail: 'Injects clicks via debugger protocol' }
                ];
                const stratSelection = await vscode.window.showQuickPick(strategies, { title: 'Select Strategy' });
                if (stratSelection) {
                    await configManager?.set('autoApprove.strategy', stratSelection.label);
                    vscode.window.showInformationMessage(`Strategy set to: ${stratSelection.label}`);
                }

            } else if (selection.label.includes('Polling')) {
                // Change Interval
                const intervals = [
                    { label: '200', description: 'Fast (Recommended)', detail: 'Instant response' },
                    { label: '500', description: 'Normal', detail: 'Balanced' },
                    { label: '1000', description: 'Slow', detail: 'Low resource usage' }
                ];
                const intSelection = await vscode.window.showQuickPick(intervals, { title: 'Select Polling Interval (ms)' });
                if (intSelection) {
                    const ms = parseInt(intSelection.label, 10);
                    await configManager?.set('autoApprove.interval', ms);
                    // Controller listens to config changes, but we specifically hook performanceMode change
                    // Config change listener in activate() calls autoApproveController.updateConfig()
                    vscode.window.showInformationMessage(`Interval set to: ${ms}ms`);
                }

            } else if (selection.label.includes('Settings')) {
                vscode.commands.executeCommand('workbench.action.openSettings', 'antigravity-plus.autoApprove');
            }
        })
    );

    // Toggle Auto Approve (Keep strictly for toggling logic)
    context.subscriptions.push(
        vscode.commands.registerCommand('antigravity-plus.toggleAutoApprove', () => {
            const newState = autoApproveController?.toggle();
            const message = newState
                ? t('notifications.autoApprove.enabled')
                : t('notifications.autoApprove.disabled');

            // Only show message if toggled via keybinding or command palette, 
            // menu interaction implies intent. But consistent feedback is good.
            vscode.window.showInformationMessage(message);

            statusBarManager?.updateAutoApproveState(newState ?? false);
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

    // 切換 Auto Wake-up (Background)
    context.subscriptions.push(
        vscode.commands.registerCommand('antigravity-plus.toggleAutoWakeup', async () => {
            const config = wakeupController?.getConfig();
            if (config) {
                const newState = !config.enabled;
                await wakeupController?.updateConfig({ enabled: newState });
                const message = newState
                    ? 'Auto Wake-up (Background Service) Enabled'
                    : 'Auto Wake-up (Background Service) Disabled';
                vscode.window.showInformationMessage(message);
            }
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
