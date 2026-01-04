/**
 * 200ms 輪詢引擎 (重構版)
 * 
 * 完全對齊競品 Auto Accept Agent / Yoke AntiGravity
 * 
 * 特點：
 * - 200ms 間隔，平衡效能和反應速度
 * - Pesosz 策略：直接呼叫 VS Code 內部命令
 * - CDP 策略：透過 Chrome DevTools Protocol 注入
 * - 可暫停/恢復
 * - Circuit Breaker 安全機制
 */

import * as vscode from 'vscode';
import { Logger } from '../../utils/logger';
import { RulesEngine } from './rules-engine';
import { CircuitBreaker } from './circuit-breaker';
import { OperationLogger } from './operation-logger';
import { CDPClient } from '../../providers/cdp-client';
import { t } from '../../i18n';

export interface PollerConfig {
    enabled: boolean;
    pollInterval: number;        // 預設 200ms
    fileOperations: boolean;
    terminalCommands: boolean;
}

export interface DetectionResult {
    type: 'accept' | 'run' | 'confirm' | 'apply';
    elementId?: string;
    selector?: string;
    text?: string;
}

export class Poller implements vscode.Disposable {
    private intervalId: NodeJS.Timeout | null = null;
    private readonly DEFAULT_POLL_INTERVAL = 200; // ms
    private pollInterval: number;
    private isRunning = false;
    private isPaused = false;

    /**
     * Pesosz 策略命令清單 (完全對齊競品)
     * 參考：Yoke AntiGravity, Auto Accept Agent
     */
    private static readonly PESOSZ_COMMANDS = [
        // Agent 核准 (核心)
        'antigravity.agent.acceptAgentStep',
        // 終端核准
        'antigravity.terminal.accept',
        // 聊天輸入核准 (競品有)
        'antigravity.chat.acceptInput',
        // 編輯器修改核准 (競品有)
        'antigravity.editor.acceptEdit',
        // Inline Suggest (Native 策略備用)
        'editor.action.inlineSuggest.commit'
    ];

    // 統計
    private stats = {
        totalPolls: 0,
        successfulDetections: 0,
        autoApproved: 0,
        blocked: 0
    };

    constructor(
        private logger: Logger,
        private rulesEngine: RulesEngine,
        private circuitBreaker: CircuitBreaker,
        private operationLogger: OperationLogger,
        private cdpClient: CDPClient | undefined,
        private config: PollerConfig
    ) {
        this.pollInterval = config.pollInterval || this.DEFAULT_POLL_INTERVAL;
    }

    /**
     * 啟動輪詢
     */
    public start(): void {
        if (this.isRunning) {
            this.logger.debug('輪詢已在運行中');
            return;
        }

        if (!this.config.enabled) {
            this.logger.info('輪詢未啟用');
            return;
        }

        this.isRunning = true;
        this.isPaused = false;

        this.intervalId = setInterval(() => {
            this.poll();
        }, this.pollInterval);

        this.logger.info(`輪詢已啟動，間隔 ${this.pollInterval}ms`);
    }

    /**
     * 停止輪詢
     */
    public stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        this.logger.info('輪詢已停止');
    }

    /**
     * 暫停輪詢
     */
    public pause(): void {
        this.isPaused = true;
        this.logger.debug('輪詢已暫停');
    }

    /**
     * 恢復輪詢
     */
    public resume(): void {
        this.isPaused = false;
        this.logger.debug('輪詢已恢復');
    }

    /**
     * 執行一次輪詢
     */
    private async poll(): Promise<void> {
        if (this.isPaused) {
            return;
        }

        // 檢查 Circuit Breaker
        if (!this.circuitBreaker.canExecute()) {
            this.logger.debug('Circuit Breaker 開啟，跳過輪詢');
            return;
        }

        this.stats.totalPolls++;

        try {
            // 主策略：Pesosz - 直接呼叫 VS Code 命令
            await this.executePesoszStrategy();

            // 輔助策略：CDP - 如果連接了就也執行
            if (this.cdpClient?.isConnected()) {
                await this.executeCDPDetection();
            }

            this.circuitBreaker.recordSuccess();
        } catch (error) {
            this.logger.error(`輪詢錯誤: ${error}`);
            this.circuitBreaker.recordFailure();
        }
    }

    /**
     * 執行 Pesosz 策略 (對齊競品)
     * 直接呼叫 Antigravity 內部命令
     */
    private async executePesoszStrategy(): Promise<void> {
        for (const cmd of Poller.PESOSZ_COMMANDS) {
            try {
                await vscode.commands.executeCommand(cmd);
            } catch {
                // 命令可能不存在或不適用，靜默忽略
            }
        }
    }

    /**
     * 執行 CDP 偵測策略
     * 透過注入腳本偵測並點擊按鈕
     */
    private async executeCDPDetection(): Promise<void> {
        if (!this.cdpClient) {
            return;
        }

        const script = `
            (function() {
                const results = [];
                const acceptSelectors = [
                    '[data-testid="accept-button"]',
                    '[data-action="accept"]',
                    'button[class*="accept"]',
                    '.accept-btn',
                    '.approve-btn'
                ];
                
                for (const selector of acceptSelectors) {
                    try {
                        const elements = document.querySelectorAll(selector);
                        elements.forEach(el => {
                            if (el.offsetParent !== null) {
                                results.push({
                                    type: 'accept',
                                    selector: selector,
                                    text: el.textContent?.trim() || ''
                                });
                            }
                        });
                    } catch (e) { }
                }
                
                return results;
            })()
        `;

        try {
            const response = await this.cdpClient.injectScript(script);
            if (response?.value && Array.isArray(response.value)) {
                for (const detection of response.value as DetectionResult[]) {
                    await this.handleDetection(detection);
                }
            }
        } catch (error) {
            this.logger.debug(`CDP 偵測失敗: ${error}`);
        }
    }

    /**
     * 處理偵測到的按鈕
     */
    private async handleDetection(detection: DetectionResult): Promise<void> {
        this.logger.debug(`偵測到按鈕: ${detection.type} - ${detection.text}`);

        // 根據類型評估規則
        let shouldApprove = true;
        let ruleResult;

        if (detection.type === 'run') {
            // 終端指令需要額外檢查
            ruleResult = this.rulesEngine.evaluate({
                type: 'terminal',
                content: detection.text || ''
            });
            shouldApprove = ruleResult.approved;
        }

        if (shouldApprove) {
            // 自動點擊
            if (detection.selector && this.cdpClient) {
                await this.cdpClient.click(detection.selector);
            }
            this.stats.autoApproved++;

            this.operationLogger.log({
                type: detection.type === 'run' ? 'terminal_command' : 'file_edit',
                action: 'approved',
                details: `Auto-clicked: ${detection.type} - ${detection.text}`,
                rule: ruleResult?.rule
            });
        } else {
            // 被規則阻擋
            this.stats.blocked++;

            this.operationLogger.log({
                type: 'blocked',
                action: 'blocked',
                details: `Blocked: ${detection.type} - ${detection.text}`,
                rule: ruleResult?.rule
            });

            // 顯示通知
            vscode.window.showWarningMessage(
                t('notifications.blocked.message', detection.text || detection.type)
            );
        }
    }

    /**
     * 取得統計資料
     */
    public getStats(): typeof this.stats {
        return { ...this.stats };
    }

    /**
     * 重置統計
     */
    public resetStats(): void {
        this.stats = {
            totalPolls: 0,
            successfulDetections: 0,
            autoApproved: 0,
            blocked: 0
        };
    }

    /**
     * 更新設定
     */
    public updateConfig(config: Partial<PollerConfig>): void {
        if (config.pollInterval !== undefined) {
            this.pollInterval = config.pollInterval;
        }

        if (config.enabled !== undefined) {
            this.config.enabled = config.enabled;
            if (config.enabled && !this.isRunning) {
                this.start();
            } else if (!config.enabled && this.isRunning) {
                this.stop();
            }
        }
    }

    /**
     * 是否正在運行
     */
    public isActive(): boolean {
        return this.isRunning && !this.isPaused;
    }

    /**
     * 釋放資源
     */
    public dispose(): void {
        this.stop();
    }
}
