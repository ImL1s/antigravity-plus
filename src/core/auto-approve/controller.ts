/**
 * Auto Accept Controller (Pesosz 策略完整移植)
 * 
 * 完全按照 pesosz/antigravity-auto-accept v1.0.3 實現
 * 
 * 關鍵行為：
 * - 預設 enabled = true（一安裝就生效）
 * - 使用 500ms 輪詢間隔
 * - 只需要 2 個命令：antigravity.agent.acceptAgentStep, antigravity.terminal.accept
 * - 不需要 CDP！純 VS Code 命令
 * - 一啟動就執行 startLoop()，不管設定
 */

import * as vscode from 'vscode';
import { Logger } from '../../utils/logger';
import { ConfigManager } from '../../utils/config';
import { RulesEngine } from './rules-engine';
import { OperationLogger, OperationLog } from './operation-logger';
import { ImpactTracker } from './impact-tracker';

export interface ApprovalResult {
    approved: boolean;
    reason?: string;
    rule?: string;
}

export class AutoApproveController implements vscode.Disposable {
    /**
     * Pesosz: 預設啟用 (enabled = true)
     * 原始代碼：let enabled = true;
     */
    private enabled: boolean = true;
    private autoAcceptInterval: NodeJS.Timeout | null = null;
    private statusBarItem: vscode.StatusBarItem | undefined;
    private rulesEngine: RulesEngine;
    private operationLogger: OperationLogger;
    private impactTracker: ImpactTracker | null = null;
    private disposables: vscode.Disposable[] = [];
    private isDisposed: boolean = false;

    /**
     * Pesosz 使用的輪詢間隔：500ms
     * 原始代碼：setInterval(..., 500);
     */
    private readonly POLL_INTERVAL_MS = 500;

    /**
     * Pesosz 使用的兩個核心命令
     * 原始代碼：
     *   await vscode.commands.executeCommand('antigravity.agent.acceptAgentStep');
     *   await vscode.commands.executeCommand('antigravity.terminal.accept');
     */
    private static readonly ACCEPT_COMMANDS = [
        'antigravity.agent.acceptAgentStep',
        'antigravity.terminal.accept'
    ];

    constructor(
        private context: vscode.ExtensionContext,
        private logger: Logger,
        private configManager: ConfigManager
    ) {
        this.rulesEngine = new RulesEngine(configManager);
        this.operationLogger = new OperationLogger(context);

        this.initialize();
    }

    /**
     * 初始化 (對齊 Pesosz activate 函數)
     */
    private initialize(): void {
        this.logger.info('AutoApproveController 初始化中... (Pesosz 策略)');

        // 創建狀態列項目 (對齊 Pesosz: Right, Priority 10000)
        this.createStatusBarItem();

        // Pesosz 行為：一啟動就執行 startLoop()
        // 原始代碼：startLoop(); (在 activate 最後無條件呼叫)
        this.startLoop();

        this.logger.info('AutoApproveController 初始化完成');
    }

    /**
     * 創建狀態列項目 (對齊 Pesosz)
     * 原始代碼：
     *   statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 10000);
     *   statusBarItem.command = 'unlimited.toggle';
     */
    private createStatusBarItem(): void {
        try {
            this.statusBarItem = vscode.window.createStatusBarItem(
                vscode.StatusBarAlignment.Right,
                10000
            );
            this.statusBarItem.command = 'antigravity-plus.toggleAutoApprove';
            this.disposables.push(this.statusBarItem);
            this.updateStatusBar();
            this.statusBarItem.show();
        } catch (e) {
            this.logger.debug(`狀態列創建失敗: ${e}`);
        }
    }

    /**
     * 更新狀態列顯示 (對齊 Pesosz updateStatusBar)
     * 原始代碼完全複製：
     *   if (enabled) {
     *     statusBarItem.text = "✅ Auto-Accept: ON";
     *     statusBarItem.tooltip = "Unlimited Auto-Accept is Executing (Click to Pause)";
     *     statusBarItem.backgroundColor = undefined;
     *   } else {
     *     statusBarItem.text = "🛑 Auto-Accept: OFF";
     *     statusBarItem.tooltip = "Unlimited Auto-Accept is Paused (Click to Resume)";
     *     statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
     *   }
     */
    private updateStatusBar(): void {
        if (!this.statusBarItem) return;

        if (this.enabled) {
            this.statusBarItem.text = "✅ Auto-Accept: ON";
            this.statusBarItem.tooltip = "Unlimited Auto-Accept is Executing (Click to Pause)";
            this.statusBarItem.backgroundColor = undefined;
        } else {
            this.statusBarItem.text = "🛑 Auto-Accept: OFF";
            this.statusBarItem.tooltip = "Unlimited Auto-Accept is Paused (Click to Resume)";
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        }
    }

    /**
     * 開始輪詢迴圈 (對齊 Pesosz startLoop)
     * 原始代碼：
     *   autoAcceptInterval = setInterval(async () => {
     *     if (!enabled) return;
     *     try { await vscode.commands.executeCommand('antigravity.agent.acceptAgentStep'); } catch (e) { }
     *     try { await vscode.commands.executeCommand('antigravity.terminal.accept'); } catch (e) { }
     *   }, 500);
     */
    private startLoop(): void {
        if (this.autoAcceptInterval) {
            clearInterval(this.autoAcceptInterval);
        }

        this.autoAcceptInterval = setInterval(async () => {
            if (!this.enabled || this.isDisposed) return;

            for (const cmd of AutoApproveController.ACCEPT_COMMANDS) {
                try {
                    await vscode.commands.executeCommand(cmd);
                    // 記錄成功執行的點擊
                    this.impactTracker?.recordClick();
                } catch (e) {
                    // 靜默忽略，與 Pesosz 一致
                }
            }
        }, this.POLL_INTERVAL_MS);

        this.logger.info(`Auto-Accept 輪詢已啟動 (間隔: ${this.POLL_INTERVAL_MS}ms)`);
    }

    /**
     * 停止輪詢迴圈
     */
    private stopLoop(): void {
        if (this.autoAcceptInterval) {
            clearInterval(this.autoAcceptInterval);
            this.autoAcceptInterval = null;
        }
        this.logger.info('Auto-Accept 輪詢已停止');
    }

    /**
     * 切換開關 (對齊 Pesosz toggle 命令)
     * 原始代碼：
     *   enabled = !enabled;
     *   updateStatusBar();
     *   if (enabled) {
     *     vscode.window.showInformationMessage('Auto-Accept: ON ✅');
     *   } else {
     *     vscode.window.showInformationMessage('Auto-Accept: OFF 🛑');
     *   }
     */
    public toggle(): boolean {
        this.enabled = !this.enabled;
        this.updateStatusBar();

        if (this.enabled) {
            vscode.window.showInformationMessage('Auto-Accept: ON ✅');
            this.startLoop();
        } else {
            vscode.window.showInformationMessage('Auto-Accept: OFF 🛑');
            this.stopLoop();
        }

        this.logger.info(`Auto-Accept 已${this.enabled ? '啟用' : '停用'}`);
        return this.enabled;
    }

    public enable(): void {
        if (!this.enabled) {
            this.toggle();
        }
    }

    public disable(): void {
        if (this.enabled) {
            this.toggle();
        }
    }

    /**
     * 評估終端命令 (額外安全功能)
     */
    public evaluateTerminalCommand(command: string): ApprovalResult {
        if (!this.enabled) {
            return { approved: false, reason: '自動核准未啟用' };
        }

        const result = this.rulesEngine.evaluate({
            type: 'terminal',
            content: command
        });

        this.operationLogger.log({
            type: 'terminal_command',
            action: result.approved ? 'approved' : 'blocked',
            details: command,
            rule: result.rule
        });

        return result;
    }

    /**
     * 評估檔案操作 (額外安全功能)
     */
    public evaluateFileOperation(filePath: string, operation: string): ApprovalResult {
        if (!this.enabled) {
            return { approved: false, reason: '自動核准未啟用' };
        }

        const result = this.rulesEngine.evaluate({
            type: 'file',
            content: filePath,
            operation
        });

        this.operationLogger.log({
            type: 'file_edit',
            action: result.approved ? 'approved' : 'blocked',
            details: `${operation}: ${filePath}`,
            rule: result.rule
        });

        return result;
    }

    public getOperationLogs(limit?: number): OperationLog[] {
        return this.operationLogger.getLogs(limit);
    }

    public updateConfig(): void {
        this.rulesEngine.updateRules();
        this.updateStatusBar();
        this.logger.info('AutoApproveController 設定已更新');
    }

    public isEnabled(): boolean {
        return this.enabled;
    }

    public setPollingInterval(_intervalMs: number): void {
        // 保持 Pesosz 的 500ms 間隔
        this.logger.debug('輪詢間隔保持 500ms (對齊 Pesosz)');
    }

    /**
     * 設定 Impact Tracker（用於記錄統計）
     */
    public setImpactTracker(tracker: ImpactTracker): void {
        this.impactTracker = tracker;
        this.logger.debug('ImpactTracker 已設定');
    }

    public dispose(): void {
        this.isDisposed = true;
        this.stopLoop();
        this.disposables.forEach(d => d.dispose());
        this.logger.info('AutoApproveController 已釋放');
    }
}
