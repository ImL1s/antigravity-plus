/**
 * 自動核准控制器 (重構版)
 * 
 * 移除 CDP 依賴，使用更安全的方式
 * 
 * 注意：Auto Accept 功能需要 Antigravity 提供相應的 API 或命令
 * 目前僅提供規則評估和操作日誌功能
 */

import * as vscode from 'vscode';
import { Logger } from '../../utils/logger';
import { ConfigManager } from '../../utils/config';
import { RulesEngine } from './rules-engine';
import { OperationLogger, OperationLog } from './operation-logger';

export interface ApprovalResult {
    approved: boolean;
    reason?: string;
    rule?: string;
}

export class AutoApproveController implements vscode.Disposable {
    private enabled: boolean = false;
    private rulesEngine: RulesEngine;
    private operationLogger: OperationLogger;
    private disposables: vscode.Disposable[] = [];

    constructor(
        private context: vscode.ExtensionContext,
        private logger: Logger,
        private configManager: ConfigManager
    ) {
        this.enabled = configManager.get<boolean>('autoApprove.enabled') ?? false;
        this.rulesEngine = new RulesEngine(configManager);
        this.operationLogger = new OperationLogger(context);

        this.initialize();
    }

    /**
     * 初始化控制器
     * 注意：不再使用 CDP，改用 VS Code 原生機制
     */
    private async initialize(): Promise<void> {
        this.logger.info('AutoApproveController 初始化中...');

        // 監聽終端指令
        this.setupTerminalListener();

        // 嘗試使用 VS Code 的 chat.tools.autoApprove 設定
        this.setupAutoApproveConfig();

        this.logger.info('AutoApproveController 初始化完成');
    }

    /**
     * 設定自動核准配置
     * 使用 VS Code 的原生設定
     */
    private setupAutoApproveConfig(): void {
        if (this.enabled) {
            // 嘗試設定 VS Code 的自動核准
            // 注意：這需要 VS Code 1.96+ 和相應的 AI 擴充功能支援
            try {
                const config = vscode.workspace.getConfiguration('chat.tools');
                // 只設定安全的自動核准
                // config.update('autoApprove', { ... }, vscode.ConfigurationTarget.Global);
                this.logger.debug('自動核准配置已應用');
            } catch (error) {
                this.logger.debug('VS Code 自動核准配置不可用');
            }
        }
    }

    /**
     * 設定終端監聯器
     */
    private setupTerminalListener(): void {
        // 監聽終端創建
        this.disposables.push(
            vscode.window.onDidOpenTerminal(terminal => {
                this.logger.debug(`終端已開啟: ${terminal.name}`);
            })
        );
    }

    /**
     * 切換自動核准狀態
     */
    public toggle(): boolean {
        this.enabled = !this.enabled;

        // 同時更新設定
        vscode.workspace.getConfiguration('antigravity-plus').update(
            'autoApprove.enabled',
            this.enabled,
            vscode.ConfigurationTarget.Global
        );

        this.logger.info(`自動核准已${this.enabled ? '啟用' : '停用'}`);

        // 更新自動核准配置
        this.setupAutoApproveConfig();

        return this.enabled;
    }

    /**
     * 啟用自動核准
     */
    public enable(): void {
        if (!this.enabled) {
            this.toggle();
        }
    }

    /**
     * 停用自動核准
     */
    public disable(): void {
        if (this.enabled) {
            this.toggle();
        }
    }

    /**
     * 評估終端指令是否可以自動執行
     */
    public evaluateTerminalCommand(command: string): ApprovalResult {
        if (!this.enabled) {
            return { approved: false, reason: '自動核准未啟用' };
        }

        const result = this.rulesEngine.evaluate({
            type: 'terminal',
            content: command
        });

        // 記錄操作
        this.operationLogger.log({
            type: 'terminal_command',
            action: result.approved ? 'approved' : 'blocked',
            details: command,
            rule: result.rule
        });

        return result;
    }

    /**
     * 評估檔案操作是否可以自動接受
     */
    public evaluateFileOperation(filePath: string, operation: string): ApprovalResult {
        if (!this.enabled) {
            return { approved: false, reason: '自動核准未啟用' };
        }

        const fileOperationsEnabled = this.configManager.get<boolean>('autoApprove.fileOperations') ?? true;
        if (!fileOperationsEnabled) {
            return { approved: false, reason: '檔案操作自動核准未啟用' };
        }

        const result = this.rulesEngine.evaluate({
            type: 'file',
            content: filePath,
            operation
        });

        // 記錄操作
        this.operationLogger.log({
            type: 'file_edit',
            action: result.approved ? 'approved' : 'blocked',
            details: `${operation}: ${filePath}`,
            rule: result.rule
        });

        return result;
    }

    /**
     * 取得操作日誌
     */
    public getOperationLogs(limit?: number): OperationLog[] {
        return this.operationLogger.getLogs(limit);
    }

    /**
     * 更新設定
     */
    public updateConfig(): void {
        this.enabled = this.configManager.get<boolean>('autoApprove.enabled') ?? false;
        this.rulesEngine.updateRules();
        this.setupAutoApproveConfig();
        this.logger.info('AutoApproveController 設定已更新');
    }

    /**
     * 取得目前狀態
     */
    public isEnabled(): boolean {
        return this.enabled;
    }

    /**
     * 設定輪詢間隔
     */
    public setPollingInterval(intervalMs: number): void {
        this.logger.debug(`輪詢間隔已更新: ${intervalMs}ms`);
        // 保留此方法以維持 API 相容性
    }

    /**
     * 釋放資源
     */
    public dispose(): void {
        this.disposables.forEach(d => d.dispose());
        this.logger.info('AutoApproveController 已釋放');
    }
}
