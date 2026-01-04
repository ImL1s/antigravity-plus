
import * as vscode from 'vscode';
import { Logger } from '../../utils/logger';
import { ConfigManager } from '../../utils/config';
import { RulesEngine } from './rules-engine';
import { OperationLogger, OperationLog } from './operation-logger';
import { CDPManager } from './cdp-manager';

export interface ApprovalResult {
    approved: boolean;
    reason?: string;
    rule?: string;
}

export class AutoApproveController implements vscode.Disposable {
    private enabled: boolean = false;
    private rulesEngine: RulesEngine;
    private operationLogger: OperationLogger;
    private cdpManager: CDPManager;
    private disposables: vscode.Disposable[] = [];
    private intervalId: NodeJS.Timeout | null = null;
    private isDisposed: boolean = false;

    constructor(
        private context: vscode.ExtensionContext,
        private logger: Logger,
        private configManager: ConfigManager,
        cdpManager?: CDPManager // Optional injection for testing
    ) {
        this.enabled = this.configManager.get<boolean>('autoApprove.enabled') ?? false;
        this.logger.info(`AutoApproveController initialized (Enabled: ${this.enabled})`);
        this.rulesEngine = new RulesEngine(configManager);
        this.operationLogger = new OperationLogger(context);
        this.cdpManager = cdpManager || new CDPManager(logger);

        this.initialize();
    }

    /**
     * Initialize the controller
     */
    private async initialize(): Promise<void> {
        this.logger.info('AutoApproveController 初始化中...');

        // Listen for terminal creation
        this.setupTerminalListener();

        // Try to setup VS Code native auto approve config if applicable
        this.setupAutoApproveConfig();

        // Start polling for auto-approval strategies
        this.startPolling();

        this.logger.info('AutoApproveController 初始化完成');
    }

    /**
     * Setup VS Code native auto-approve configuration
     */
    private setupAutoApproveConfig(): void {
        if (this.enabled) {
            try {
                // In a real scenario, this might set vscode configuration for chat tools
                // const config = vscode.workspace.getConfiguration('chat.tools');
                this.logger.debug('自動核准配置已應用');
            } catch (error) {
                this.logger.debug('VS Code 自動核准配置不可用');
            }
        }
    }

    /**
     * Setup terminal listener
     */
    private setupTerminalListener(): void {
        this.disposables.push(
            vscode.window.onDidOpenTerminal(terminal => {
                this.logger.debug(`終端已開啟: ${terminal.name}`);
            })
        );
    }

    /**
     * Start the polling loop based on configured strategy
     */
    private startPolling(): void {
        const intervalMs = this.configManager.get<number>('autoApprove.interval') ?? 1000;

        if (this.intervalId) {
            clearInterval(this.intervalId);
        }

        this.logger.info(`Starting AutoApprove polling (Interval: ${intervalMs}ms)`);

        this.intervalId = setInterval(async () => {
            await this.poll();
        }, intervalMs);
    }

    private async poll() {
        if (!this.enabled || this.isDisposed) {
            return;
        }

        try {
            const config = vscode.workspace.getConfiguration('antigravity-plus.autoApprove');
            const strategy = config.get<string>('strategy', 'pesosz');

            if (strategy === 'pesosz') {
                await this.executePesoszStrategy();
            } else if (strategy === 'native') {
                await this.executeNativeStrategy();
            } else if (strategy === 'cdp') {
                await this.executeCDPStrategy();
            }
        } catch (error) {
            this.logger.error(`AutoApprove Polling Error: ${error}`);
        }
    }

    /**
     * Pesosz Strategy: Directly invoke Antigravity internal commands.
     */
    private async executePesoszStrategy() {
        try {
            await vscode.commands.executeCommand('antigravity.agent.acceptAgentStep');
        } catch (e) { void (e); }

        try {
            await vscode.commands.executeCommand('antigravity.terminal.accept');
        } catch (e) { void (e); }
    }

    /**
     * Native Strategy: Use VS Code's inline suggest commit command.
     */
    private async executeNativeStrategy() {
        try {
            await vscode.commands.executeCommand('editor.action.inlineSuggest.commit');
        } catch (e) { void (e); }
    }

    /**
     * CDP Strategy: Use passive CDP injection
     */
    private async executeCDPStrategy() {
        const denyList = this.configManager.get<string[]>('autoApprove.denyList') ?? [];
        const allowList = this.configManager.get<string[]>('autoApprove.allowList') ?? [];
        const interval = this.configManager.get<number>('autoApprove.interval') ?? 1000;

        const success = await this.cdpManager.tryConnectAndInject({
            denyList,
            allowList,
            clickInterval: interval
        });

        if (!success) {
            // Fallback to Pesosz strategy could be implemented here
        }
    }

    /**
     * Toggle auto-approve state
     */
    public toggle(): boolean {
        this.enabled = !this.enabled;

        vscode.workspace.getConfiguration('antigravity-plus').update(
            'autoApprove.enabled',
            this.enabled,
            vscode.ConfigurationTarget.Global
        );

        this.logger.info(`自動核准已${this.enabled ? '啟用' : '停用'}`);
        this.setupAutoApproveConfig();

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
     * Evaluate if a terminal command should be allowed
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
     * Evaluate if a file operation should be allowed
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
        this.enabled = this.configManager.get<boolean>('autoApprove.enabled') ?? false;
        this.rulesEngine.updateRules();
        this.setupAutoApproveConfig();

        // Refresh polling interval
        this.startPolling();

        this.logger.info('AutoApproveController 設定已更新');
    }

    public isEnabled(): boolean {
        return this.enabled;
    }

    public setPollingInterval(intervalMs: number): void {
        this.logger.debug(`輪詢間隔已更新: ${intervalMs}ms`);
        // The actual update happens via config change triggering updateConfig, 
        // or we could force restart polling here if needed.
        // For now, assume updateConfig covers it or this is just for API compatibility.
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = setInterval(async () => {
                await this.poll();
            }, intervalMs);
        }
    }

    public dispose(): void {
        this.isDisposed = true;
        if (this.intervalId) clearInterval(this.intervalId);
        this.disposables.forEach(d => d.dispose());
        this.cdpManager.dispose();
        this.logger.info('AutoApproveController 已釋放');
    }
}
