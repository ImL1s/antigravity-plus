/**
 * Antigravity 用量資料提供者
 * 
 * 參考 AntigravityQuotaWatcher 的實作
 * 
 * 工作原理：
 * 1. 檢測 Antigravity/language server 進程
 * 2. 提取端口和認證信息
 * 3. 呼叫內部 API (GetUserStatus) 獲取配額
 */

import { Logger } from '../utils/logger';
import { QuotaData, ModelQuota } from '../core/quota-monitor/controller';
import * as http from 'http';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface AntigravityConnection {
    port: number;
    authToken: string;
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

            // 呼叫 GetUserStatus API
            const response = await this.callApi('GetUserStatus', {});

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
            // 根據作業系統選擇檢測方法
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
     * Windows 系統連接檢測
     */
    private async detectConnectionWindows(): Promise<void> {
        try {
            // 使用 PowerShell 查找 Antigravity 進程
            const { stdout } = await execAsync(
                `powershell -Command "Get-Process | Where-Object {$_.ProcessName -like '*antigravity*' -or $_.ProcessName -like '*code*'} | Select-Object -ExpandProperty Id"`,
                { timeout: 10000 }
            );

            const pids = stdout.trim().split('\n').filter(Boolean);

            for (const pid of pids) {
                const connection = await this.tryExtractConnectionFromProcess(pid.trim());
                if (connection) {
                    this.connection = connection;
                    return;
                }
            }

            // 嘗試常見端口
            await this.tryCommonPorts();
        } catch (error) {
            this.logger.debug(`Windows 連接檢測失敗: ${error}`);
            await this.tryCommonPorts();
        }
    }

    /**
     * Unix 系統連接檢測
     */
    private async detectConnectionUnix(): Promise<void> {
        try {
            // 使用 lsof 或 netstat 查找
            const { stdout } = await execAsync(
                `lsof -i -P -n | grep -E "(antigravity|language-server)" | grep LISTEN`,
                { timeout: 10000 }
            );

            const lines = stdout.trim().split('\n').filter(Boolean);

            for (const line of lines) {
                const match = line.match(/:(\d+) \(LISTEN\)/);
                if (match) {
                    const port = parseInt(match[1]);
                    const connection = await this.testPort(port);
                    if (connection) {
                        this.connection = connection;
                        return;
                    }
                }
            }

            await this.tryCommonPorts();
        } catch (error) {
            this.logger.debug(`Unix 連接檢測失敗: ${error}`);
            await this.tryCommonPorts();
        }
    }

    /**
     * 從進程提取連接資訊
     */
    private async tryExtractConnectionFromProcess(pid: string): Promise<AntigravityConnection | undefined> {
        try {
            // 查找進程監聽的端口
            const { stdout } = await execAsync(
                `netstat -ano | findstr ${pid} | findstr LISTENING`,
                { timeout: 5000 }
            );

            const match = stdout.match(/:(\d+)\s+/);
            if (match) {
                const port = parseInt(match[1]);
                return this.testPort(port);
            }
        } catch (error) {
            // 忽略錯誤
        }
        return undefined;
    }

    /**
     * 嘗試常見的端口
     */
    private async tryCommonPorts(): Promise<void> {
        const commonPorts = [9222, 9333, 9444, 3000, 3001, 8080, 8888];

        for (const port of commonPorts) {
            const connection = await this.testPort(port);
            if (connection) {
                this.connection = connection;
                return;
            }
        }
    }

    /**
     * 測試端口是否為 Antigravity 服務
     */
    private async testPort(port: number): Promise<AntigravityConnection | undefined> {
        return new Promise((resolve) => {
            const options = {
                hostname: 'localhost',
                port: port,
                path: '/json/version',
                method: 'GET',
                timeout: 2000
            };

            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (json.Browser && json.Browser.includes('Antigravity')) {
                            resolve({
                                port,
                                authToken: json.webSocketDebuggerUrl || ''
                            });
                            return;
                        }
                    } catch {
                        // 不是 JSON 回應
                    }
                    resolve(undefined);
                });
            });

            req.on('error', () => resolve(undefined));
            req.on('timeout', () => {
                req.destroy();
                resolve(undefined);
            });

            req.end();
        });
    }

    /**
     * 呼叫 Antigravity API
     */
    private async callApi(method: string, params: any): Promise<any> {
        if (!this.connection) {
            throw new Error('未連接到 Antigravity');
        }

        const connection = this.connection; // 使用本地變數

        return new Promise((resolve, reject) => {
            const postData = JSON.stringify({
                jsonrpc: '2.0',
                method,
                params,
                id: Date.now()
            });

            const options = {
                hostname: 'localhost',
                port: connection.port,
                path: '/api',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData),
                    'Authorization': `Bearer ${connection.authToken}`
                },
                timeout: 10000
            };

            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        resolve(json.result);
                    } catch {
                        resolve(undefined);
                    }
                });
            });

            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('API 請求超時'));
            });

            req.write(postData);
            req.end();
        });
    }

    /**
     * 解析配額回應
     */
    private parseQuotaResponse(response: any): QuotaData {
        const models: ModelQuota[] = [];

        // 解析模型配額
        if (response.quotas && Array.isArray(response.quotas)) {
            for (const quota of response.quotas) {
                models.push({
                    name: quota.model || quota.name,
                    displayName: this.getModelDisplayName(quota.model || quota.name),
                    used: quota.used || 0,
                    total: quota.limit || quota.total || 100,
                    percentage: Math.round(((quota.used || 0) / (quota.limit || quota.total || 100)) * 100),
                    resetTime: quota.resetTime ? new Date(quota.resetTime) : undefined
                });
            }
        }

        // 如果沒有配額資料，創建預設資料
        if (models.length === 0) {
            models.push(
                { name: 'gemini-3-pro', displayName: 'Gemini 3 Pro', used: 0, total: 100, percentage: 100 },
                { name: 'gemini-3-flash', displayName: 'Gemini 3 Flash', used: 0, total: 100, percentage: 100 }
            );
        }

        return {
            models,
            accountLevel: response.accountLevel || response.tier || 'Free',
            promptCredits: response.promptCredits,
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
