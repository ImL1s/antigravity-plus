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
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// 常數（優化後：競品使用 10s/15s，我們取中間平衡值）
const API_ENDPOINT = '/exa.language_server_pb.LanguageServerService/GetUserStatus';
const HTTP_TIMEOUT_MS = 5000;  // 原 10000ms，平衡快速失敗與穩定性
const PROCESS_CMD_TIMEOUT_MS = 8000;  // 原 15000ms，平衡 PowerShell 冷啟動

interface AntigravityConnection {
    port: number;
    csrfToken: string;
}

interface ProcessInfo {
    pid: number;
    port: number;
    csrfToken: string;
}

export class AntigravityUsageProvider {
    protected connection: AntigravityConnection | undefined;
    private hasSuccessfulSync = false;  // ✅ 對標 Cockpit: 追蹤是否成功過

    constructor(private logger: Logger) { }

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

            // 呼叫 GetUserStatus API (使用正確的方式)
            const response = await this.callApi();

            if (response) {
                this.hasSuccessfulSync = true;  // 標記成功
                return this.parseQuotaResponse(response);
            }

            return undefined;
        } catch (error) {
            this.logger.error(`獲取配額失敗: ${error}`);
            // Fail fast: Let the controller handle retries
            // This prevents "Spinning for ages" issues
            this.connection = undefined;
            return undefined;
        }
    }

    /**
     * 帶指數退避的初始化連接 (對標 Cockpit reactor.ts:177-208)
     * 
     * @param maxRetries 最大重試次數
     * @param currentRetry 當前重試次數
     */
    public async initWithRetry(maxRetries = 3, currentRetry = 0): Promise<QuotaData | undefined> {
        try {
            return await this.fetchQuota();
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));

            if (currentRetry < maxRetries) {
                // 指數退避: 2s, 4s, 6s
                const delay = 2000 * (currentRetry + 1);
                this.logger.warn(`初始化失敗，重試 ${currentRetry + 1}/${maxRetries} (等待 ${delay}ms): ${err.message}`);

                await this.delay(delay);
                return this.initWithRetry(maxRetries, currentRetry + 1);
            }

            this.logger.error(`初始化失敗，已達最大重試次數 (${maxRetries}): ${err.message}`);
            return undefined;
        }
    }

    /**
     * 延遲輔助函數
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 檢測 Antigravity 連接 (參考競品 ProcessHunter)
     */
    protected async detectConnection(): Promise<void> {
        this.logger.debug('正在檢測 Antigravity 連接...');

        try {
            const platform = os.platform();

            if (platform === 'win32') {
                await this.detectConnectionWindows();
            } else {
                await this.detectConnectionUnix();
            }

            if (this.connection) {
                this.logger.info(`連接成功: port=${this.connection.port}`);
            }
        } catch (error) {
            this.logger.error(`檢測連接失敗: ${error}`);
        }
    }

    /**
     * Windows 系統連接檢測 (參考競品 WindowsStrategy)
     */
    private async detectConnectionWindows(): Promise<void> {
        try {
            // 使用 PowerShell 查找 Antigravity Language Server 進程
            // 關鍵：從命令行參數中提取 csrf_token
            const cmd = `powershell -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'csrf_token' } | Select-Object ProcessId, CommandLine | ConvertTo-Json"`;

            const { stdout } = await execAsync(cmd, { timeout: PROCESS_CMD_TIMEOUT_MS });

            if (!stdout || !stdout.trim()) {
                this.logger.debug('未找到 Antigravity 進程');
                return;
            }

            const processes = JSON.parse(stdout);
            const processList = Array.isArray(processes) ? processes : [processes];

            for (const proc of processList) {
                if (!proc.CommandLine) continue;

                const info = this.parseProcessInfo(proc.ProcessId, proc.CommandLine);
                if (info) {
                    // 驗證連接
                    const verified = await this.verifyConnection(info.port, info.csrfToken);
                    if (verified) {
                        this.connection = { port: info.port, csrfToken: info.csrfToken };
                        return;
                    }
                }
            }
        } catch (error) {
            this.logger.debug(`Windows 連接檢測失敗: ${error}`);
        }
    }

    /**
     * Unix 系統連接檢測
     */
    private async detectConnectionUnix(): Promise<void> {
        try {
            // 使用 ps 查找包含 csrf_token 的進程
            const cmd = `ps aux | grep -E 'language_server|antigravity' | grep csrf_token`;

            const { stdout } = await execAsync(cmd, { timeout: PROCESS_CMD_TIMEOUT_MS });

            if (!stdout || !stdout.trim()) {
                this.logger.debug('未找到 Antigravity 進程');
                return;
            }

            const lines = stdout.trim().split('\n').filter(Boolean);

            for (const line of lines) {
                // 從命令行提取 port 和 csrf_token
                const portMatch = line.match(/--server_port[=\s]+(\d+)/);
                const tokenMatch = line.match(/--csrf_token[=\s]+([a-f0-9-]+)/i);

                if (portMatch && tokenMatch) {
                    const port = parseInt(portMatch[1]);
                    const csrfToken = tokenMatch[1];

                    const verified = await this.verifyConnection(port, csrfToken);
                    if (verified) {
                        this.connection = { port, csrfToken };
                        return;
                    }
                }
            }
        } catch (error) {
            this.logger.debug(`Unix 連接檢測失敗: ${error}`);
        }
    }

    /**
     * 從命令行解析進程資訊
     */
    private parseProcessInfo(pid: number, commandLine: string): ProcessInfo | undefined {
        // 提取 server_port
        const portMatch = commandLine.match(/--server_port[=\s]+(\d+)/);
        // 提取 csrf_token
        const tokenMatch = commandLine.match(/--csrf_token[=\s]+([a-f0-9-]+)/i);

        if (portMatch && tokenMatch) {
            return {
                pid,
                port: parseInt(portMatch[1]),
                csrfToken: tokenMatch[1]
            };
        }

        return undefined;
    }

    /**
     * 驗證連接是否有效
     */
    protected async verifyConnection(port: number, csrfToken: string): Promise<boolean> {
        return new Promise((resolve) => {
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
                timeout: 5000
            };

            const req = https.request(options, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(body);
                        // 如果有 userStatus，則連接有效
                        resolve(Boolean(json.userStatus));
                    } catch {
                        resolve(false);
                    }
                });
            });

            req.on('error', () => resolve(false));
            req.on('timeout', () => {
                req.destroy();
                resolve(false);
            });

            req.write(data);
            req.end();
        });
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

            const resetTime = quotaInfo.resetTime ? new Date(quotaInfo.resetTime) : new Date();
            const now = new Date();
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
                timeUntilResetFormatted: this.formatDelta(timeUntilReset),
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
