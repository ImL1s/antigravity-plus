/**
 * Antigravity 用量資料提供者 (重構版)
 * 
 * 參考 jlcodes99/vscode-antigravity-cockpit 的正確實作
 * 
 * 關鍵發現：
 * 1. 使用 HTTPS 連接到 127.0.0.1:port
 * 2. Header 需要 X-Codeium-Csrf-Token
 * 3. API 端點是 /exa.language_server_pb.LanguageServerService/GetUserStatus
 */

import { Logger } from '../utils/logger';
import { QuotaData, ModelQuota } from '../core/quota-monitor/controller';
import * as https from 'https';
import { ProcessDetector, AntigravityProcess } from '../core/quota-monitor/process-detector';

// 常數
const API_ENDPOINT = '/exa.language_server_pb.LanguageServerService/GetUserStatus';
const HTTP_TIMEOUT_MS = 5000;

interface AntigravityConnection {
    port: number;
    csrfToken: string;
}

export class AntigravityUsageProvider {
    protected connection: AntigravityConnection | undefined;
    private connectionRetries = 0;
    private readonly MAX_RETRIES = 3;
    private processDetector: ProcessDetector;

    constructor(private logger: Logger) {
        this.processDetector = new ProcessDetector(logger);
    }

    /**
     * 獲取配額資料
     */
    public async fetchQuota(): Promise<QuotaData | undefined> {
        try {
            // 確保已連接
            if (!this.connection) {
                await this.detectConnection();
            }

            if (!this.connection) {
                this.logger.warn('無法連接到 Antigravity 服務');
                return undefined;
            }

            // 呼叫 GetUserStatus API
            const response = await this.callApi();

            if (response) {
                return this.parseQuotaResponse(response);
            }

            return undefined;
        } catch (error) {
            this.logger.error(`獲取配額失敗: ${error}`);

            // 重試連接
            this.connectionRetries++;
            if (this.connectionRetries < this.MAX_RETRIES) {
                this.connection = undefined;
                return this.fetchQuota();
            }

            return undefined;
        }
    }

    /**
     * 檢測 Antigravity 連接
     */
    protected async detectConnection(): Promise<void> {
        this.logger.debug('正在檢測 Antigravity 連接...');

        try {
            const process = await this.processDetector.detect();

            if (process) {
                this.logger.info(`連接成功: PID=${process.pid}, Port=${process.connectPort}`);
                this.connection = {
                    port: process.connectPort,
                    csrfToken: process.csrfToken
                };
                this.connectionRetries = 0;
            } else {
                this.logger.debug('未檢測到 Antigravity 進程');
            }
        } catch (error) {
            this.logger.error(`檢測連接失敗: ${error}`);
        }
    }

    /**
     * 呼叫 Antigravity API (正確方式：HTTPS + X-Codeium-Csrf-Token)
     */
    protected async callApi(): Promise<any> {
        if (!this.connection) {
            throw new Error('未連接到 Antigravity');
        }

        const { port, csrfToken } = this.connection;

        return new Promise((resolve, reject) => {
            const data = JSON.stringify({
                metadata: {
                    ideName: 'antigravity',
                    extensionName: 'antigravity-plus',
                    locale: 'en'
                }
            });

            const options: https.RequestOptions = {
                hostname: '127.0.0.1',
                port: port,
                path: API_ENDPOINT,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data),
                    'Connect-Protocol-Version': '1',
                    'X-Codeium-Csrf-Token': csrfToken
                },
                rejectUnauthorized: false,
                timeout: HTTP_TIMEOUT_MS
            };

            this.logger.debug(`Calling API: ${API_ENDPOINT}`);

            const req = https.request(options, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    this.logger.debug(`API Response: ${res.statusCode}`);

                    if (!body || !body.trim()) {
                        reject(new Error('Empty response from server'));
                        return;
                    }

                    try {
                        resolve(JSON.parse(body));
                    } catch {
                        reject(new Error(`Invalid JSON response`));
                    }
                });
            });

            req.on('error', (e) => reject(new Error(`Connection failed: ${e.message}`)));
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timed out'));
            });

            req.write(data);
            req.end();
        });
    }

    /**
     * 解析配額回應 (對標 Cockpit reactor.ts decodeSignal)
     */
    private parseQuotaResponse(response: any): QuotaData {
        const models: ModelQuota[] = [];

        // 驗證回應結構
        if (!response || !response.userStatus) {
            this.logger.warn('Invalid response structure');
            return this.createDefaultQuotaData();
        }

        const status = response.userStatus;
        const plan = status.planStatus?.planInfo;

        // ✅ 對標 Cockpit: 使用 cascadeModelConfigData.clientModelConfigs
        const modelConfigs = status.cascadeModelConfigData?.clientModelConfigs || [];

        // 解析每個模型的配額
        for (const config of modelConfigs) {
            // ✅ 對標 Cockpit: 使用 quotaInfo.remainingFraction
            const quotaInfo = config.quotaInfo;
            if (!quotaInfo) continue;  // 跳過沒有配額資訊的模型

            const remainingFraction = quotaInfo.remainingFraction;
            const remainingPercentage = remainingFraction !== undefined
                ? remainingFraction * 100  // ✅ 剩餘百分比 (不是已使用)
                : 0;

            const now = new Date();
            let resetTime = quotaInfo.resetTime ? new Date(quotaInfo.resetTime) : new Date();
            let resetTimeValid = true;

            // ✅ 對標 Cockpit: 檢查 resetTime 是否有效
            if (Number.isNaN(resetTime.getTime())) {
                resetTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 預設 24 小時後
                resetTimeValid = false;
                this.logger.warn(`Invalid resetTime for model ${config.label}: ${quotaInfo.resetTime}`);
            }

            const timeUntilReset = resetTime.getTime() - now.getTime();

            // ✅ 對標 Cockpit: 使用 label 和 modelOrAlias.model
            models.push({
                name: config.modelOrAlias?.model || 'unknown',
                displayName: config.label || this.getModelDisplayName(config.modelOrAlias?.model || 'unknown'),
                used: Math.round(100 - remainingPercentage),  // 已使用百分比
                total: 100,
                percentage: Math.round(100 - remainingPercentage),  // 已使用百分比
                resetTime: resetTime,
                // ✅ 新增欄位 (對標 Cockpit)
                remainingFraction: remainingFraction,
                remainingPercentage: remainingPercentage,
                isExhausted: remainingFraction === 0,
                timeUntilReset: timeUntilReset,
                timeUntilResetFormatted: resetTimeValid ? this.formatDelta(timeUntilReset) : 'Unknown',
                // 能力欄位
                supportsImages: config.supportsImages,
                isRecommended: config.isRecommended,
                tagTitle: config.tagTitle,
            });
        }

        // 如果沒有配額資料，創建預設資料
        if (models.length === 0) {
            return this.createDefaultQuotaData();
        }

        // ✅ 對標 Cockpit: 解析 PromptCredits
        const credits = status.planStatus?.availablePromptCredits;
        let promptCredits: { used: number; total: number; usedPercentage?: number; remainingPercentage?: number } | undefined;

        if (plan && credits !== undefined) {
            const monthlyLimit = Number(plan.monthlyPromptCredits || 0);
            const availableVal = Number(credits);

            if (monthlyLimit > 0) {
                promptCredits = {
                    used: monthlyLimit - availableVal,
                    total: monthlyLimit,
                    usedPercentage: ((monthlyLimit - availableVal) / monthlyLimit) * 100,
                    remainingPercentage: (availableVal / monthlyLimit) * 100,
                };
            }
        }

        return {
            models,
            accountLevel: status.userTier?.name || plan?.teamsTier || 'Free',
            promptCredits,
            lastUpdated: new Date(),
            // ✅ 新增欄位
            userInfo: {
                name: status.name || 'Unknown',
                email: status.email || 'N/A',
                tier: status.userTier?.name || 'N/A',
            }
        };
    }

    /**
     * 格式化倒計時 (對標 Cockpit formatDelta)
     */
    private formatDelta(ms: number): string {
        if (ms <= 0) return 'Ready';

        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ${hours % 24}h`;
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m`;
        return `${seconds}s`;
    }

    /**
     * 創建預設配額資料
     */
    private createDefaultQuotaData(): QuotaData {
        return {
            models: [
                { name: 'gemini-3-pro', displayName: 'Gemini 3 Pro', used: 0, total: 100, percentage: 0 },
                { name: 'gemini-3-flash', displayName: 'Gemini 3 Flash', used: 0, total: 100, percentage: 0 }
            ],
            accountLevel: 'Unknown',
            lastUpdated: new Date()
        };
    }

    /**
     * 取得模型顯示名稱
     */
    private getModelDisplayName(model: string): string {
        const displayNames: Record<string, string> = {
            'gemini-3-pro': 'Gemini 3 Pro',
            'gemini-3-pro-high': 'Gemini 3 Pro (High)',
            'gemini-3-flash': 'Gemini 3 Flash',
            'claude-sonnet-4.5': 'Claude Sonnet 4.5',
            'claude-opus-4.5': 'Claude Opus 4.5',
            'gpt-oss-120b': 'GPT-OSS 120B'
        };

        return displayNames[model] || model;
    }
}
