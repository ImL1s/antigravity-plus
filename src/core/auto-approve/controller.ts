/**
 * 自動核准控制器
 * 
 * 負責攔截和自動核准 AI Agent 的操作請求
 * 
 * 技術參考：Yoke AntiGravity 的 CDP 整合方式
 */

import * as vscode from 'vscode';
import { Logger } from '../../utils/logger';
import { ConfigManager } from '../../utils/config';
import { RulesEngine } from './rules-engine';
import { OperationLogger, OperationLog } from './operation-logger';
import { CDPClient } from '../../providers/cdp-client';

export interface ApprovalResult {
    approved: boolean;
    reason?: string;
    rule?: string;
}

export class AutoApproveController implements vscode.Disposable {
    private enabled: boolean = false;
    private rulesEngine: RulesEngine;
    private operationLogger: OperationLogger;
    private cdpClient: CDPClient | undefined;
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
     */
    private async initialize(): Promise<void> {
        this.logger.info('AutoApproveController 初始化中...');

        // 初始化 CDP 客戶端（用於深度整合）
        try {
            this.cdpClient = new CDPClient(this.logger);
            await this.cdpClient.connect();
            this.logger.info('CDP 客戶端已連接');
        } catch (error) {
            this.logger.warn('CDP 客戶端連接失敗，將使用備用方案');
        }

        // 監聽終端指令
        this.setupTerminalListener();

        this.logger.info('AutoApproveController 初始化完成');
    }

    /**
     * 設定終端監聽器
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
        // 如果有 Poller 實例，更新其間隔
    }

    /**
     * 釋放資源
     */
    public dispose(): void {
        this.cdpClient?.disconnect();
        this.disposables.forEach(d => d.dispose());
        this.logger.info('AutoApproveController 已釋放');
    }
}
