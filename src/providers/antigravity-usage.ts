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

// 常數
const API_ENDPOINT = '/exa.language_server_pb.LanguageServerService/GetUserStatus';
const HTTP_TIMEOUT_MS = 10000;
const PROCESS_CMD_TIMEOUT_MS = 15000;

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
    private connectionRetries = 0;
    private readonly MAX_RETRIES = 3;

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
                this.connectionRetries = 0;
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
    private async verifyConnection(port: number, csrfToken: string): Promise<boolean> {
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
    private async callApi(): Promise<any> {
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
     * 解析配額回應 (參考競品 decodeSignal)
     */
    private parseQuotaResponse(response: any): QuotaData {
        const models: ModelQuota[] = [];

        // 驗證回應結構
        if (!response || !response.userStatus) {
            this.logger.warn('Invalid response structure');
            return this.createDefaultQuotaData();
        }

        const status = response.userStatus;
        const modelConfigs = status.modelConfigs || [];

        // 解析每個模型的配額
        for (const config of modelConfigs) {
            const remainingFraction = config.remainingRequestsFraction;
            const percentage = remainingFraction !== undefined
                ? Math.round((1 - remainingFraction) * 100)
                : 0;

            models.push({
                name: config.modelId || config.model || 'unknown',
                displayName: this.getModelDisplayName(config.modelId || config.model || 'unknown'),
                used: percentage,
                total: 100,
                percentage: percentage,
                resetTime: config.resetTime ? new Date(config.resetTime) : undefined
            });
        }

        // 如果沒有配額資料，創建預設資料
        if (models.length === 0) {
            return this.createDefaultQuotaData();
        }

        return {
            models,
            accountLevel: status.planStatus?.planInfo?.tier || 'Free',
            promptCredits: status.planStatus?.availablePromptCredits !== undefined ? {
                used: 0,
                total: Number(status.planStatus.planInfo?.monthlyPromptCredits || 0)
            } : undefined,
            lastUpdated: new Date()
        };
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
