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
import { DashboardPanel, DashboardSerializer } from './ui/dashboard';
import { Logger } from './utils/logger';
import { ConfigManager } from './utils/config';
import { initI18n, updateLocale, t } from './i18n';
import { QuickPickQuotaDisplay } from './core/quota-monitor/quickpick';
import { GroupingManager } from './core/quota-monitor/grouping';
import { StatusBarFormatter } from './core/quota-monitor/status-bar-format';

// 全域實例
let autoApproveController: AutoApproveController | undefined;
let quotaMonitorController: QuotaMonitorController | undefined;
let impactTracker: ImpactTracker | undefined;
let performanceMode: PerformanceModeController | undefined;
let wakeupController: AutoWakeupController | undefined;
let statusBarManager: StatusBarManager | undefined;
let logger: Logger | undefined;
let configManager: ConfigManager | undefined;
let groupingManager: GroupingManager | undefined;
let quickPickDisplay: QuickPickQuotaDisplay | undefined;
let statusBarFormatter: StatusBarFormatter | undefined;

/**
 * 擴展啟動
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
    console.log('[DEBUG] Antigravity Plus: activate() started');
    try {

        // 初始化 i18n
        initI18n();

        // 取得版本號
        const extension = vscode.extensions.getExtension('ImL1s.antigravity-plus');
        const version = extension ? extension.packageJSON.version : '0.0.19-dev';
        console.log(`[DEBUG] Antigravity Plus Version: ${version}`);

        // 初始化工具
        logger = new Logger();
        configManager = new ConfigManager();

        // 初始化 Impact & Performance
        impactTracker = new ImpactTracker(context);
        performanceMode = new PerformanceModeController(context);

        console.log('[DEBUG] Antigravity Plus: Basic tools initialized');
        // 初始化 UI 工具
        statusBarFormatter = new StatusBarFormatter();
        console.log('[DEBUG] Antigravity Plus: StatusBarFormatter initialized');

        // 初始化 UI
        statusBarManager = new StatusBarManager(context, statusBarFormatter);
        console.log('[DEBUG] Antigravity Plus: StatusBarManager initialized');

        // 初始化控制器
        autoApproveController = new AutoApproveController(context, logger, configManager);
        autoApproveController.setImpactTracker(impactTracker); // 連接 Impact Tracker
        console.log('[DEBUG] Antigravity Plus: AutoApproveController initialized');
        quotaMonitorController = new QuotaMonitorController(context, logger, configManager, statusBarManager);
        console.log('[DEBUG] Antigravity Plus: QuotaMonitorController initialized');
        wakeupController = new AutoWakeupController(context, logger);
        console.log('[DEBUG] Antigravity Plus: AutoWakeupController initialized');

        // 初始化 Cockpit 對齊模組
        groupingManager = new GroupingManager(context);
        quickPickDisplay = new QuickPickQuotaDisplay(groupingManager);
        console.log('[DEBUG] Antigravity Plus: Cockpit modules initialized');

        // 開始新 session
        impactTracker.startSession();

        // 監聽 Performance Mode 變更
        performanceMode.onChange((interval) => {
            autoApproveController?.setPollingInterval(interval);
        });

        // 註冊指令
        console.log('[DEBUG] Antigravity Plus: Registering commands...');
        registerCommands(context, version);

        // 4. 連接事件 (UI Updates)
        quotaMonitorController?.onDidUpdateQuota(data => {
            if (DashboardPanel.currentPanel) {
                DashboardPanel.currentPanel.updateQuota(data);
            }
        });

        // 5. 註冊 Webview Serializer (修復重啟後 Panel 失效問題)
        vscode.window.registerWebviewPanelSerializer(
            DashboardPanel.viewType,
            new DashboardSerializer(
                context.extensionUri,
                impactTracker,
                performanceMode,
                wakeupController!,
                () => autoApproveController?.isEnabled() ?? false,
                version
            )
        );

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
            // DELAYED STARTUP: Wait 5 seconds to allow VS Code to stabilize
            // This prevents "Startup Storm" where wmic/process scans compete with IDE initialization
            setTimeout(() => {
                quotaMonitorController?.start().catch(err => {
                    logger?.error(`QuotaMonitor start error: ${err}`);
                });
            }, 5000);
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
function registerCommands(context: vscode.ExtensionContext, version: string): void {
    // 開啟 Dashboard
    // 開啟 Dashboard (根據設定決定顯示模式)
    context.subscriptions.push(
        vscode.commands.registerCommand('antigravity-plus.openDashboard', async () => {
            const config = vscode.workspace.getConfiguration('antigravity-plus.quota');
            const displayMode = config.get<string>('displayMode') || 'webview';

            if (displayMode === 'quickpick' && quickPickDisplay) {
                // 使用 QuickPick 模式
                const data = quotaMonitorController?.getQuotaData();
                if (data) {
                    await quickPickDisplay.show(data);
                } else {
                    vscode.window.showInformationMessage(t('notifications.quota.loading') || 'Quota data loading...');
                    // 嘗試刷新並顯示
                    await quotaMonitorController?.refresh().then(() => {
                        const newData = quotaMonitorController?.getQuotaData();
                        if (newData) quickPickDisplay!.show(newData);
                    });
                }
            } else {
                // 使用 Webview 模式
                DashboardPanel.createOrShow(
                    context.extensionUri,
                    impactTracker!,
                    performanceMode!,
                    wakeupController!,
                    autoApproveController?.isEnabled() ?? false,
                    version
                );
            }
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

    // QuickPick 備用模式 (Cockpit 對齊)
    context.subscriptions.push(
        vscode.commands.registerCommand('antigravity-plus.showQuickPick', async () => {
            const data = quotaMonitorController?.getQuotaData();
            if (!data) {
                vscode.window.showWarningMessage(t('statusBar.quota.noData'));
                return;
            }

            // 使用新的 QuickPickQuotaDisplay（支援分組、置頂等功能）
            await quickPickDisplay?.show(data);
        })
    );

    // 測試 Auto Wake-up
    context.subscriptions.push(
        vscode.commands.registerCommand('antigravity-plus.testWakeup', async () => {
            await wakeupController?.testNow();
            vscode.window.showInformationMessage('Auto Wake-up 測試已執行');
        })
    );

    // 切換狀態列格式 (Cockpit 對齊 - 6 種格式)
    context.subscriptions.push(
        vscode.commands.registerCommand('antigravity-plus.changeStatusBarFormat', async () => {
            const formats = StatusBarFormatter.getAvailableFormats();
            const currentFormat = statusBarFormatter?.getFormat() || 'icon-percent';

            const items = formats.map(f => ({
                label: f.id === currentFormat ? `$(check) ${f.label}` : f.label,
                description: f.example,
                format: f.id
            }));

            const selection = await vscode.window.showQuickPick(items, {
                title: '狀態列格式',
                placeHolder: '選擇狀態列顯示格式'
            });

            if (selection) {
                statusBarFormatter?.setFormat(selection.format as any);
                vscode.window.showInformationMessage(`狀態列格式已變更為: ${selection.description}`);
                // 刷新狀態列
                statusBarManager?.refresh();
            }
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

    // 切換配額分組模式 (Cockpit 對齊)
    context.subscriptions.push(
        vscode.commands.registerCommand('antigravity-plus.toggleGrouping', async () => {
            const vsConfig = vscode.workspace.getConfiguration('antigravity-plus.quota');
            const currentState = vsConfig.get<boolean>('groupingEnabled') ?? true;
            const newState = !currentState;

            await vsConfig.update('groupingEnabled', newState, vscode.ConfigurationTarget.Global);

            const message = newState
                ? '配額分組模式: 已啟用 📊'
                : '配額分組模式: 已停用 📋';
            vscode.window.showInformationMessage(message);

            // 刷新顯示
            statusBarManager?.refresh();
        })
    );
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
