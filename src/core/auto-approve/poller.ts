/**
 * 200ms 輪詢引擎
 * 
 * 參考 Auto Accept Agent 的高效輪詢策略
 * 
 * 特點：
 * - 200ms 間隔，平衡效能和反應速度
 * - 可暫停/恢復
 * - 支援多種偵測目標
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
    private lastDetectionTime: number = 0;
    private detectionCount = 0;

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
            // 偵測可點擊的按鈕
            const detections = await this.detectButtons();

            if (detections.length > 0) {
                this.stats.successfulDetections++;

                for (const detection of detections) {
                    await this.handleDetection(detection);
                }

                this.circuitBreaker.recordSuccess();
            }
        } catch (error) {
            this.logger.error(`輪詢錯誤: ${error}`);
            this.circuitBreaker.recordFailure();
        }
    }

    /**
     * 偵測可自動點擊的按鈕
     */
    private async detectButtons(): Promise<DetectionResult[]> {
        const results: DetectionResult[] = [];

        if (!this.cdpClient || !this.cdpClient.isConnected()) {
            return results;
        }

        // 使用 CDP 注入腳本偵測按鈕 (基於 MunKhin/auto-accept-agent)
        const script = `
            (function() {
                const results = [];
                
                // 判斷是否為可接受的按鈕
                function isAcceptButton(el) {
                    const text = (el.textContent || "").trim().toLowerCase();
                    if (text.length === 0 || text.length > 50) return false;
                    
                    // 接受模式
                    const patterns = ['accept', 'run', 'retry', 'apply', 'execute', 'confirm', 'allow once', 'allow'];
                    // 拒絕模式
                    const rejects = ['skip', 'reject', 'cancel', 'close', 'refine'];
                    
                    // 如果包含拒絕詞，跳過
                    if (rejects.some(r => text.includes(r))) return false;
                    // 如果不包含任何接受詞，跳過
                    if (!patterns.some(p => text.includes(p))) return false;
                    
                    // 檢查可見性
                    const style = window.getComputedStyle(el);
                    const rect = el.getBoundingClientRect();
                    return style.display !== 'none' && rect.width > 0 && 
                           style.pointerEvents !== 'none' && !el.disabled;
                }
                
                // 判斷按鈕類型
                function getButtonType(text) {
                    const lowerText = text.toLowerCase();
                    if (lowerText.includes('run') || lowerText.includes('execute')) return 'run';
                    if (lowerText.includes('apply')) return 'apply';
                    if (lowerText.includes('confirm')) return 'confirm';
                    return 'accept';
                }
                
                // Antigravity 專用選擇器 + 通用選擇器
                const selectors = [
                    '.bg-ide-button-background',  // Antigravity 主要按鈕
                    'button',
                    '[class*="button"]',
                    '[class*="anysphere"]'
                ];
                
                const found = new Set();
                
                selectors.forEach(selector => {
                    try {
                        const elements = document.querySelectorAll(selector);
                        elements.forEach(el => {
                            // 避免重複
                            if (found.has(el)) return;
                            
                            if (isAcceptButton(el)) {
                                found.add(el);
                                const text = el.textContent?.trim() || '';
                                results.push({
                                    type: getButtonType(text),
                                    selector: selector,
                                    text: text
                                });
                            }
                        });
                    } catch (e) {
                        // 選擇器可能無效，忽略
                    }
                });
                
                return results;
            })()
        `;

        try {
            const response = await this.cdpClient.injectScript(script);
            if (response && response.value) {
                return response.value as DetectionResult[];
            }
        } catch (error) {
            this.logger.debug(`按鈕偵測失敗: ${error}`);
        }

        return results;
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
            await this.clickButton(detection);
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
     * 點擊按鈕
     */
    private async clickButton(detection: DetectionResult): Promise<void> {
        if (!this.cdpClient || !this.cdpClient.isConnected()) {
            return;
        }

        if (detection.selector) {
            await this.cdpClient.click(detection.selector);
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
