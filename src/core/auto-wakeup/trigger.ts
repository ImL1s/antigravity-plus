/**
 * Wakeup Trigger - 觸發器 (重構版)
 * 
 * 參考 jlcodes99/vscode-antigravity-cockpit 的 trigger_service.ts
 * 
 * 正確做法：
 * 1. 使用 OAuth 獲取 access_token
 * 2. 呼叫 Antigravity 雲端 API (daily-cloudcode-pa.sandbox.googleapis.com)
 * 3. 發送簡單的 generateContent 請求觸發配額週期
 */

import { Logger } from '../../utils/logger';
import * as vscode from 'vscode';

// Antigravity API 配置
const ANTIGRAVITY_API_URL = 'https://daily-cloudcode-pa.sandbox.googleapis.com';
const ANTIGRAVITY_USER_AGENT = 'antigravity/1.0.0 antigravity-plus';

export interface TriggerResult {
    success: boolean;
    tokensUsed?: number;
    duration?: number;
    response?: string;
    error?: string;
}

export interface WakeupCredential {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: number;
    projectId?: string;
}

export class WakeupTrigger {
    private credential: WakeupCredential | undefined;
    private readonly STORAGE_KEY = 'antigravity-plus.wakeupCredential';

    constructor(
        private logger: Logger,
        private context: vscode.ExtensionContext
    ) {
        this.loadCredential();
    }

    /**
     * 執行喚醒觸發
     */
    public async execute(model: string, prompt: string = 'hi'): Promise<TriggerResult> {
        const startTime = Date.now();
        this.logger.info(`觸發模型: ${model}, 提示: "${prompt}"`);

        try {
            // 1. 確保有有效的 access_token
            if (!this.credential || !this.credential.accessToken) {
                return {
                    success: false,
                    error: '請先完成授權。使用指令 "Antigravity Plus: 授權 Auto Wake-up"'
                };
            }

            // 2. 檢查 token 是否過期
            if (this.credential.expiresAt && Date.now() > this.credential.expiresAt) {
                // 嘗試刷新 token
                const refreshed = await this.refreshToken();
                if (!refreshed) {
                    return {
                        success: false,
                        error: 'Access token 已過期，請重新授權'
                    };
                }
            }

            // 3. 獲取或創建 project_id
            const projectId = this.credential.projectId || await this.fetchProjectId();
            if (!projectId) {
                return {
                    success: false,
                    error: '無法獲取 project ID'
                };
            }

            // 4. 發送喚醒請求
            const response = await this.sendWakeupRequest(model, prompt, projectId);

            return {
                success: true,
                tokensUsed: 10, // 估計值
                duration: Date.now() - startTime,
                response: response
            };

        } catch (error) {
            return {
                success: false,
                duration: Date.now() - startTime,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * 檢查是否已授權
     */
    public isAuthorized(): boolean {
        return Boolean(this.credential?.accessToken);
    }

    /**
     * 開始授權流程
     * 注意：這需要用戶提供 OAuth credentials
     */
    public async startAuthorization(): Promise<boolean> {
        // 簡化版：讓用戶手動輸入 access_token
        // 完整版需要實作 OAuth 2.0 流程
        const token = await vscode.window.showInputBox({
            prompt: '請輸入您的 Antigravity Access Token',
            placeHolder: 'ya29.xxx...',
            password: true,
            ignoreFocusOut: true
        });

        if (!token) {
            return false;
        }

        // 驗證 token
        const isValid = await this.validateToken(token);
        if (!isValid) {
            vscode.window.showErrorMessage('無效的 Access Token');
            return false;
        }

        // 儲存 credential
        this.credential = {
            accessToken: token,
            expiresAt: Date.now() + (60 * 60 * 1000) // 1 小時後過期
        };
        await this.saveCredential();

        vscode.window.showInformationMessage('✅ Auto Wake-up 授權成功！');
        return true;
    }

    /**
     * 撤銷授權
     */
    public async revokeAuthorization(): Promise<void> {
        this.credential = undefined;
        await this.context.secrets.delete(this.STORAGE_KEY);
        this.logger.info('Auto Wake-up 授權已撤銷');
    }

    /**
     * 驗證 token 是否有效
     */
    private async validateToken(token: string): Promise<boolean> {
        try {
            const response = await fetch(`${ANTIGRAVITY_API_URL}/v1internal:fetchAvailableModels`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'User-Agent': ANTIGRAVITY_USER_AGENT,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            });

            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * 刷新 token (需要 refresh_token)
     */
    private async refreshToken(): Promise<boolean> {
        if (!this.credential?.refreshToken) {
            return false;
        }

        // TODO: 實作 token 刷新邏輯
        // 這需要 OAuth client_id 和 client_secret
        return false;
    }

    /**
     * 獲取 project_id
     */
    private async fetchProjectId(): Promise<string | undefined> {
        if (!this.credential?.accessToken) {
            return undefined;
        }

        try {
            // 嘗試 LoadCodeAssist
            const response = await fetch(`${ANTIGRAVITY_API_URL}/v1internal:loadCodeAssist`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.credential.accessToken}`,
                    'User-Agent': ANTIGRAVITY_USER_AGENT,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    metadata: ANTIGRAVITY_USER_AGENT
                })
            });

            if (response.ok) {
                const data = await response.json() as { project?: string };
                if (data.project) {
                    // 儲存 project_id
                    if (this.credential) {
                        this.credential.projectId = data.project;
                        await this.saveCredential();
                    }
                    return data.project;
                }
            }
        } catch (error) {
            this.logger.error(`獲取 project_id 失敗: ${error}`);
        }

        // 使用備用 project_id
        const randomId = Math.random().toString(36).substring(2, 10);
        return `projects/random-${randomId}/locations/global`;
    }

    /**
     * 發送喚醒請求
     */
    private async sendWakeupRequest(model: string, prompt: string, projectId: string): Promise<string> {
        if (!this.credential?.accessToken) {
            throw new Error('未授權');
        }

        const sessionId = this.generateSessionId();
        const requestId = this.generateRequestId();

        const requestBody = {
            project: projectId,
            requestId: requestId,
            model: model,
            userAgent: 'antigravity-plus',
            request: {
                contents: [
                    {
                        role: 'user',
                        parts: [{ text: prompt }]
                    }
                ],
                session_id: sessionId
            }
        };

        const response = await fetch(`${ANTIGRAVITY_API_URL}/v1internal:generateContent`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.credential.accessToken}`,
                'User-Agent': ANTIGRAVITY_USER_AGENT,
                'Content-Type': 'application/json',
                'Accept-Encoding': 'gzip'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API 請求失敗: ${response.status} - ${errorText.substring(0, 100)}`);
        }

        const text = await response.text();
        this.logger.debug(`generateContent 回應: ${text.substring(0, 500)}`);

        try {
            const data = JSON.parse(text) as {
                response?: {
                    candidates?: Array<{
                        content?: {
                            parts?: Array<{ text?: string }>
                        }
                    }>
                }
            };
            const aiResponse = data.response?.candidates?.[0]?.content?.parts?.[0]?.text;
            return aiResponse || '(無回應)';
        } catch {
            return '(解析回應失敗)';
        }
    }

    /**
     * 載入已儲存的 credential
     */
    private async loadCredential(): Promise<void> {
        try {
            const saved = await this.context.secrets.get(this.STORAGE_KEY);
            if (saved) {
                this.credential = JSON.parse(saved);
            }
        } catch (error) {
            this.logger.error(`載入 credential 失敗: ${error}`);
        }
    }

    /**
     * 儲存 credential (使用 VS Code Secret Storage)
     */
    private async saveCredential(): Promise<void> {
        if (this.credential) {
            await this.context.secrets.store(this.STORAGE_KEY, JSON.stringify(this.credential));
        }
    }

    /**
     * 生成 session ID
     */
    private generateSessionId(): string {
        return `session-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    }

    /**
     * 生成 request ID
     */
    private generateRequestId(): string {
        return `req-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    }
}
