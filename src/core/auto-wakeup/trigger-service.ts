/**
 * Trigger Service - 觸發服務
 * 
 * 對齊 antigravity-cockpit 的 auto_trigger/trigger_service.ts
 * 實作多模型並發觸發和配額重置自動喚醒
 */

import * as https from 'https';
import { URL } from 'url';
import { credentialStorage } from './credential-storage';
import { OAuthService } from './oauth-service';
import {
    TriggerRecord,
    ModelInfo,
    AccessTokenResult,
    ANTIGRAVITY_API_CONFIG
} from './types';
import { Logger } from '../../utils/logger';

const {
    BASE_URL,
    USER_AGENT,
    REQUEST_TIMEOUT_MS,
    MAX_TRIGGER_CONCURRENCY,
    RESET_TRIGGER_COOLDOWN_MS
} = ANTIGRAVITY_API_CONFIG;

/**
 * 觸發服務
 * 負責發送對話請求以觸發配額重置週期
 */
export class TriggerService {
    private recentTriggers: TriggerRecord[] = [];
    private readonly maxRecords = 40;
    private readonly maxDays = 7;

    // 重置觸發時間戳記錄 (用於 wakeOnReset)
    private resetTriggerTimestamps: Map<string, Set<string>> = new Map();
    // 最後一次重置觸發時間 (用於冷卻)
    private resetTriggerAt: Map<string, number> = new Map();

    constructor(
        private logger: Logger,
        private oauthService: OAuthService
    ) { }

    /**
     * 初始化：從儲存載入歷史記錄
     */
    initialize(): void {
        // 可選：從 globalState 載入歷史
        this.logger.debug('[TriggerService] Initialized');
    }

    /**
     * 檢查是否應該在配額重置時觸發喚醒
     * @param modelId 模型 ID
     * @param resetAt 當前的重置時間點 (ISO 8601)
     * @param remaining 當前剩餘配額
     * @param limit 配額上限
     * @returns true 如果應該觸發
     */
    shouldTriggerOnReset(
        modelId: string,
        resetAt: string,
        remaining: number,
        limit: number
    ): boolean {
        // 1. 檢查是否接近滿配額 (remaining >= limit - 5)
        // 這表示配額剛剛重置
        if (remaining < limit - 5) {
            return false;
        }

        // 2. 檢查這個重置時間點是否已觸發過
        const triggeredSet = this.resetTriggerTimestamps.get(modelId);
        if (triggeredSet?.has(resetAt)) {
            this.logger.debug(`[TriggerService] Already triggered for ${modelId} at ${resetAt}`);
            return false;
        }

        // 3. 檢查冷卻時間
        const lastTriggerTime = this.resetTriggerAt.get(modelId);
        if (lastTriggerTime && Date.now() - lastTriggerTime < RESET_TRIGGER_COOLDOWN_MS) {
            this.logger.debug(`[TriggerService] Cooldown active for ${modelId}`);
            return false;
        }

        this.logger.info(`[TriggerService] Should trigger on reset for ${modelId} (resetAt=${resetAt}, remaining=${remaining}/${limit})`);
        return true;
    }

    /**
     * 記錄已觸發的重置時間點
     */
    markResetTriggered(modelId: string, resetAt: string): void {
        let triggeredSet = this.resetTriggerTimestamps.get(modelId);
        if (!triggeredSet) {
            triggeredSet = new Set();
            this.resetTriggerTimestamps.set(modelId, triggeredSet);
        }
        triggeredSet.add(resetAt);
        this.resetTriggerAt.set(modelId, Date.now());

        // 清理舊的時間戳（只保留最近 24 小時）
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        for (const [key, set] of this.resetTriggerTimestamps) {
            for (const ts of set) {
                if (ts < oneDayAgo) {
                    set.delete(ts);
                }
            }
        }
    }

    /**
     * 執行觸發
     * 發送一條簡短的對話訊息以觸發配額計時
     * @param models 要觸發的模型列表
     * @param triggerType 觸發類型
     * @param customPrompt 自訂喚醒詞
     * @param triggerSource 觸發來源
     */
    async trigger(
        models?: string[],
        triggerType: 'manual' | 'auto' = 'manual',
        customPrompt?: string,
        triggerSource?: 'manual' | 'scheduled' | 'crontab' | 'quota_reset'
    ): Promise<TriggerRecord> {
        const startTime = Date.now();
        const triggerModels = (models && models.length > 0) ? models : ['gemini-3-flash'];
        const promptText = customPrompt || 'hi';
        let stage = 'start';

        this.logger.info(`[TriggerService] Starting trigger (${triggerType}) for models: ${triggerModels.join(', ')}, prompt: "${promptText}"...`);

        try {
            // 1. 獲取有效的 access_token
            stage = 'get_access_token';
            const tokenResult = await this.oauthService.getAccessTokenStatus();
            if (tokenResult.state !== 'ok' || !tokenResult.token) {
                throw new Error(`No valid access token (${tokenResult.state}). Please authorize first.`);
            }
            const accessToken = tokenResult.token;

            // 2. 獲取 project_id
            stage = 'get_project_id';
            const credential = await credentialStorage.getCredential();
            const projectId = credential?.projectId || await this.fetchProjectId(accessToken);

            // 3. 發送觸發請求（多模型並發）
            const results: Array<{
                model: string;
                ok: boolean;
                message: string;
                duration: number;
            }> = new Array(triggerModels.length);
            let nextIndex = 0;

            const worker = async () => {
                // Use index-based approach instead of while(true) to avoid lint error
                for (let i = nextIndex++; i < triggerModels.length; i = nextIndex++) {
                    const model = triggerModels[i];
                    const started = Date.now();
                    try {
                        stage = `send_trigger_request:${model}`;
                        const reply = await this.sendTriggerRequest(accessToken, projectId, model, promptText);
                        results[i] = {
                            model,
                            ok: true,
                            message: reply,
                            duration: Date.now() - started,
                        };
                    } catch (error) {
                        const err = error instanceof Error ? error : new Error(String(error));
                        results[i] = {
                            model,
                            ok: false,
                            message: err.message,
                            duration: Date.now() - started,
                        };
                    }
                }
            };

            const workerCount = Math.min(MAX_TRIGGER_CONCURRENCY, triggerModels.length);
            await Promise.all(Array.from({ length: workerCount }, () => worker()));

            const successLines = results
                .filter(r => r.ok)
                .map(r => `${r.model}: ${r.message} (${r.duration}ms)`);
            const failureLines = results
                .filter(r => !r.ok)
                .map(r => `${r.model}: ERROR ${r.message} (${r.duration}ms)`);
            const summary = [...successLines, ...failureLines].join('\n');
            const successCount = successLines.length;
            const failureCount = failureLines.length;
            const hasSuccess = successCount > 0;

            // 4. 記錄結果
            const record: TriggerRecord = {
                timestamp: new Date().toISOString(),
                success: hasSuccess,
                prompt: `[${triggerModels.join(', ')}] ${promptText}`,
                message: summary,
                duration: Date.now() - startTime,
                triggerType,
                triggerSource: triggerSource || (triggerType === 'manual' ? 'manual' : undefined),
                models: triggerModels,
            };

            this.addRecord(record);

            if (hasSuccess && failureCount === 0) {
                this.logger.info(`[TriggerService] Trigger successful in ${record.duration}ms`);
            } else if (hasSuccess) {
                this.logger.warn(`[TriggerService] Trigger completed with partial failures (success=${successCount}, failed=${failureCount})`);
            } else {
                this.logger.error(`[TriggerService] Trigger failed for all models`);
            }

            return record;

        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            this.logger.error(`[TriggerService] Trigger failed (stage=${stage}): ${err.message}`);

            const record: TriggerRecord = {
                timestamp: new Date().toISOString(),
                success: false,
                prompt: `[${triggerModels.join(', ')}] ${promptText}`,
                message: err.message,
                duration: Date.now() - startTime,
                triggerType,
                triggerSource: triggerSource || (triggerType === 'manual' ? 'manual' : undefined),
                models: triggerModels,
            };

            this.addRecord(record);
            return record;
        }
    }

    /**
     * 獲取最近的觸發記錄
     */
    getRecentTriggers(): TriggerRecord[] {
        return [...this.recentTriggers];
    }

    /**
     * 獲取最後一次觸發記錄
     */
    getLastTrigger(): TriggerRecord | undefined {
        return this.recentTriggers[0];
    }

    /**
     * 清空歷史記錄
     */
    clearHistory(): void {
        this.recentTriggers = [];
        this.logger.info('[TriggerService] History cleared');
    }

    /**
     * 添加觸發記錄
     */
    private addRecord(record: TriggerRecord): void {
        this.recentTriggers.unshift(record);
        this.recentTriggers = this.cleanupRecords(this.recentTriggers);
    }

    /**
     * 清理過期記錄
     */
    private cleanupRecords(records: TriggerRecord[]): TriggerRecord[] {
        const cutoff = new Date(Date.now() - this.maxDays * 24 * 60 * 60 * 1000).toISOString();
        return records
            .filter(r => r.timestamp > cutoff)
            .slice(0, this.maxRecords);
    }

    /**
     * 獲取 project_id
     */
    private async fetchProjectId(accessToken: string): Promise<string> {
        return new Promise((resolve) => {
            const url = new URL(`${BASE_URL}/v1internal:loadCodeAssist`);

            const req = https.request(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'User-Agent': USER_AGENT,
                    'Content-Type': 'application/json',
                },
                timeout: REQUEST_TIMEOUT_MS,
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', async () => {
                    try {
                        const json = JSON.parse(data);
                        if (json.project) {
                            await credentialStorage.updateProjectId(json.project);
                            resolve(json.project);
                            return;
                        }
                    } catch { /* ignore */ }

                    // 使用備用 project_id
                    const randomId = Math.random().toString(36).substring(2, 10);
                    resolve(`projects/random-${randomId}/locations/global`);
                });
            });

            req.on('error', () => {
                const randomId = Math.random().toString(36).substring(2, 10);
                resolve(`projects/random-${randomId}/locations/global`);
            });

            req.write(JSON.stringify({ metadata: USER_AGENT }));
            req.end();
        });
    }

    /**
     * 獲取可用模型列表
     */
    async fetchAvailableModels(filterByConstants?: string[]): Promise<ModelInfo[]> {
        const tokenResult = await this.oauthService.getAccessTokenStatus();
        if (tokenResult.state !== 'ok' || !tokenResult.token) {
            return [];
        }

        return new Promise((resolve) => {
            const url = new URL(`${BASE_URL}/v1internal:fetchAvailableModels`);

            const req = https.request(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${tokenResult.token}`,
                    'User-Agent': USER_AGENT,
                    'Content-Type': 'application/json',
                },
                timeout: REQUEST_TIMEOUT_MS,
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (!json.models) {
                            resolve([]);
                            return;
                        }

                        const allModels: ModelInfo[] = Object.entries(json.models).map(([id, info]: [string, any]) => ({
                            id,
                            displayName: info.displayName || id,
                            modelConstant: info.model || '',
                        }));

                        if (filterByConstants && filterByConstants.length > 0) {
                            const modelMap = new Map<string, ModelInfo>();
                            for (const model of allModels) {
                                if (model.modelConstant) {
                                    modelMap.set(model.modelConstant, model);
                                }
                            }

                            const sorted: ModelInfo[] = [];
                            for (const constant of filterByConstants) {
                                const model = modelMap.get(constant);
                                if (model) {
                                    sorted.push(model);
                                }
                            }
                            resolve(sorted);
                        } else {
                            resolve(allModels);
                        }
                    } catch {
                        resolve([]);
                    }
                });
            });

            req.on('error', () => resolve([]));
            req.write('{}');
            req.end();
        });
    }

    /**
     * 發送觸發請求
     */
    private async sendTriggerRequest(
        accessToken: string,
        projectId: string,
        model: string,
        prompt: string = 'hi'
    ): Promise<string> {
        const sessionId = this.generateSessionId();
        const requestId = this.generateRequestId();

        const requestBody = {
            project: projectId,
            requestId,
            model,
            userAgent: 'antigravity-plus',
            request: {
                contents: [
                    {
                        role: 'user',
                        parts: [{ text: prompt }],
                    },
                ],
                session_id: sessionId,
            },
        };

        return new Promise((resolve, reject) => {
            const url = new URL(`${BASE_URL}/v1internal:generateContent`);

            const req = https.request(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'User-Agent': USER_AGENT,
                    'Content-Type': 'application/json',
                    'Accept-Encoding': 'gzip',
                },
                timeout: REQUEST_TIMEOUT_MS,
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    if (res.statusCode !== 200) {
                        reject(new Error(`API error: ${res.statusCode} - ${data.substring(0, 100)}`));
                        return;
                    }

                    try {
                        const json = JSON.parse(data);
                        const candidates = json.response?.candidates || json.candidates;
                        const reply = candidates?.[0]?.content?.parts?.[0]?.text || '(無回覆)';
                        resolve(reply.trim());
                    } catch {
                        resolve('(解析回應失敗)');
                    }
                });
            });

            req.on('error', (err) => reject(err));
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.write(JSON.stringify(requestBody));
            req.end();
        });
    }

    /**
     * 生成 session_id
     */
    private generateSessionId(): string {
        return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    }

    /**
     * 生成 request_id
     */
    private generateRequestId(): string {
        return `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    }
}

/**
 * 建立 TriggerService 實例
 */
export function createTriggerService(logger: Logger, oauthService: OAuthService): TriggerService {
    return new TriggerService(logger, oauthService);
}
