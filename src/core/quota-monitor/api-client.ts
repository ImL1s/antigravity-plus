/**
 * GetUserStatus API 客戶端
 * 
 * 參考 AntigravityQuotaWatcher 的實作
 * 
 * 負責與 Antigravity 內部 API 通訊，獲取配額資料
 */

import * as http from 'http';
import * as https from 'https';
import { Logger } from '../../utils/logger';
import { ProcessDetector, AntigravityProcess } from './process-detector';

export interface RawQuotaData {
    models?: ModelQuotaRaw[];
    tier?: string;
    accountLevel?: string;
    promptCredits?: {
        used: number;
        total: number;
    };
    resetTime?: string;
}

export interface ModelQuotaRaw {
    model?: string;
    name?: string;
    used?: number;
    limit?: number;
    total?: number;
    remaining?: number;
    resetTime?: string;
    pool?: string;  // 用於分組
}

export interface ApiClientConfig {
    timeout: number;
    retries: number;
    retryDelay: number;
}

const DEFAULT_CONFIG: ApiClientConfig = {
    timeout: 10000,
    retries: 3,
    retryDelay: 1000
};

export class ApiClient {
    private config: ApiClientConfig;
    private processDetector: ProcessDetector;
    private cachedProcess: AntigravityProcess | null = null;
    private lastProcessCheck: number = 0;
    private readonly PROCESS_CACHE_TTL = 60000; // 1 分鐘

    constructor(
        private logger: Logger,
        config?: Partial<ApiClientConfig>
    ) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.processDetector = new ProcessDetector(logger);
    }

    /**
     * 獲取用戶狀態（配額資料）
     */
    public async getUserStatus(): Promise<RawQuotaData | null> {
        const process = await this.getAntigravityProcess();

        if (!process) {
            this.logger.warn('無法找到 Antigravity 進程');
            return null;
        }

        for (let attempt = 0; attempt < this.config.retries; attempt++) {
            try {
                const data = await this.callApi(process, 'GetUserStatus', {});
                return data as RawQuotaData;
            } catch (error) {
                this.logger.debug(`API 請求失敗 (嘗試 ${attempt + 1}/${this.config.retries}): ${error}`);

                if (attempt < this.config.retries - 1) {
                    await this.delay(this.config.retryDelay);
                }
            }
        }

        // 重置快取，下次重新偵測進程
        this.cachedProcess = null;
        return null;
    }

    /**
     * 獲取 Antigravity 進程（帶快取）
     */
    private async getAntigravityProcess(): Promise<AntigravityProcess | null> {
        const now = Date.now();

        if (this.cachedProcess && (now - this.lastProcessCheck) < this.PROCESS_CACHE_TTL) {
            return this.cachedProcess;
        }

        this.cachedProcess = await this.processDetector.detect();
        this.lastProcessCheck = now;

        return this.cachedProcess;
    }

    /**
     * 呼叫 API
     */
    private async callApi(
        process: AntigravityProcess,
        method: string,
        params: any
    ): Promise<any> {
        return new Promise((resolve, reject) => {
            const postData = JSON.stringify({
                jsonrpc: '2.0',
                method,
                params,
                id: Date.now()
            });

            const url = new URL(process.endpoint);
            const isHttps = url.protocol === 'https:';
            const httpModule = isHttps ? https : http;

            const options = {
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: url.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData),
                    ...(process.authToken ? { 'Authorization': `Bearer ${process.authToken}` } : {})
                },
                timeout: this.config.timeout
            };

            const req = httpModule.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (json.error) {
                            reject(new Error(json.error.message || 'API 錯誤'));
                        } else {
                            resolve(json.result);
                        }
                    } catch {
                        reject(new Error('無法解析 API 回應'));
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
     * 延遲
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 清除快取
     */
    public clearCache(): void {
        this.cachedProcess = null;
        this.lastProcessCheck = 0;
    }
}
