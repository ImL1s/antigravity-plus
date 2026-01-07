/**
 * OAuth Service - OAuth 2.0 服務
 * 
 * 對齊 antigravity-cockpit 的 auto_trigger/oauth_service.ts
 * 實作完整的 Google OAuth 2.0 授權流程
 */

import * as vscode from 'vscode';
import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';
import { credentialStorage } from './credential-storage';
import {
    OAuthCredential,
    AccessTokenResult,
    AuthorizationStatus,
    OAUTH_CONFIG
} from './types';
import { Logger } from '../../utils/logger';

/**
 * OAuth 服務
 */
export class OAuthService {
    private logger: Logger;
    private callbackServer: http.Server | undefined;
    private pendingAuthResolve: ((value: boolean) => void) | undefined;

    constructor(logger: Logger) {
        this.logger = logger;
    }

    /**
     * 獲取授權狀態
     */
    async getAuthorizationStatus(): Promise<AuthorizationStatus> {
        const credential = await credentialStorage.getCredential();

        if (!credential?.accessToken) {
            return { isAuthorized: false };
        }

        return {
            isAuthorized: true,
            email: credential.email,
            expiresAt: credential.expiresAt,
            lastRefresh: new Date().toISOString(),
        };
    }

    /**
     * 開始授權流程
     * 開啟瀏覽器讓用戶登入 Google 帳號
     */
    async startAuthorization(): Promise<boolean> {
        this.logger.info('[OAuthService] Starting authorization flow...');

        // 檢查是否有用戶提供的 Client ID/Secret
        const config = vscode.workspace.getConfiguration('antigravity-plus');
        const clientId = config.get<string>('wakeup.oauth.clientId');
        const clientSecret = config.get<string>('wakeup.oauth.clientSecret');

        if (!clientId || !clientSecret) {
            // 引導用戶設定 Client ID/Secret
            const result = await vscode.window.showWarningMessage(
                'Auto Wake-up 需要 Google OAuth Client ID 和 Secret。\n您可以在 Google Cloud Console 建立 OAuth 憑證。',
                '輸入 Client ID',
                '查看說明'
            );

            if (result === '查看說明') {
                vscode.env.openExternal(vscode.Uri.parse('https://console.cloud.google.com/apis/credentials'));
                return false;
            }

            if (result === '輸入 Client ID') {
                return this.manualCredentialInput();
            }

            return false;
        }

        // 啟動本地回呼伺服器
        const { port, codePromise } = await this.startCallbackServer();

        // 建立授權 URL
        const authUrl = this.buildAuthUrl(clientId, port);

        // 開啟瀏覽器
        await vscode.env.openExternal(vscode.Uri.parse(authUrl));

        // 等待回呼
        try {
            const code = await codePromise;
            if (!code) {
                this.logger.warn('[OAuthService] Authorization cancelled or failed');
                return false;
            }

            // 交換 Token
            const success = await this.exchangeCodeForToken(code, clientId, clientSecret, port);
            return success;
        } finally {
            this.stopCallbackServer();
        }
    }

    /**
     * 手動輸入憑證（簡化版，用於用戶沒有 OAuth App 的情況）
     */
    private async manualCredentialInput(): Promise<boolean> {
        const accessToken = await vscode.window.showInputBox({
            prompt: '請輸入您的 Antigravity Access Token',
            placeHolder: 'ya29.xxx...',
            password: true,
            ignoreFocusOut: true,
        });

        if (!accessToken) {
            return false;
        }

        // 驗證 Token
        const isValid = await this.validateToken(accessToken);
        if (!isValid) {
            vscode.window.showErrorMessage('無效的 Access Token');
            return false;
        }

        // 儲存憑證
        const credential: OAuthCredential = {
            clientId: '',
            clientSecret: '',
            accessToken,
            refreshToken: '',
            expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 小時
            scopes: [],
        };

        await credentialStorage.saveCredential(credential);
        vscode.window.showInformationMessage('✅ Auto Wake-up 授權成功！');
        return true;
    }

    /**
     * 驗證 Token
     */
    private async validateToken(token: string): Promise<boolean> {
        return new Promise((resolve) => {
            const url = new URL('https://daily-cloudcode-pa.sandbox.googleapis.com/v1internal:fetchAvailableModels');

            const req = https.request(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            }, (res) => {
                resolve(res.statusCode === 200);
            });

            req.on('error', () => resolve(false));
            req.write('{}');
            req.end();
        });
    }

    /**
     * 獲取 Access Token 狀態
     * 自動刷新過期的 Token
     */
    async getAccessTokenStatus(): Promise<AccessTokenResult> {
        const credential = await credentialStorage.getCredential();

        if (!credential?.accessToken) {
            return { state: 'not_authorized' };
        }

        // 檢查是否過期
        if (await credentialStorage.isTokenExpired()) {
            // 嘗試刷新
            if (credential.refreshToken && credential.clientId && credential.clientSecret) {
                const refreshed = await this.refreshAccessToken();
                if (refreshed) {
                    const newCredential = await credentialStorage.getCredential();
                    return { state: 'ok', token: newCredential?.accessToken };
                }
                return { state: 'refresh_failed' };
            }
            return { state: 'expired' };
        }

        return { state: 'ok', token: credential.accessToken };
    }

    /**
     * 刷新 Access Token
     */
    private async refreshAccessToken(): Promise<boolean> {
        const credential = await credentialStorage.getCredential();
        if (!credential?.refreshToken || !credential.clientId || !credential.clientSecret) {
            return false;
        }

        this.logger.info('[OAuthService] Refreshing access token...');

        return new Promise((resolve) => {
            const postData = new URLSearchParams({
                client_id: credential.clientId,
                client_secret: credential.clientSecret,
                refresh_token: credential.refreshToken,
                grant_type: 'refresh_token',
            }).toString();

            const req = https.request(OAUTH_CONFIG.TOKEN_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(postData),
                },
            }, async (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', async () => {
                    try {
                        const json = JSON.parse(data);
                        if (json.error === 'invalid_grant') {
                            this.logger.warn('[OAuthService] Refresh token invalid (invalid_grant)');
                            await credentialStorage.clearCredential();
                            resolve(false);
                            return;
                        }

                        if (json.access_token) {
                            const expiresAt = new Date(Date.now() + (json.expires_in || 3600) * 1000).toISOString();
                            await credentialStorage.updateAccessToken(json.access_token, expiresAt);
                            this.logger.info('[OAuthService] Token refreshed successfully');
                            resolve(true);
                        } else {
                            resolve(false);
                        }
                    } catch {
                        resolve(false);
                    }
                });
            });

            req.on('error', () => resolve(false));
            req.write(postData);
            req.end();
        });
    }

    /**
     * 撤銷授權
     */
    async revokeAuthorization(): Promise<void> {
        this.logger.info('[OAuthService] Revoking authorization...');
        await credentialStorage.clearCredential();
        vscode.window.showInformationMessage('Auto Wake-up 授權已撤銷');
    }

    /**
     * 獲取有效的 access_token（必要時自動刷新）
     */
    async getValidAccessToken(): Promise<string | null> {
        const result = await this.getAccessTokenStatus();
        return result.state === 'ok' ? result.token ?? null : null;
    }

    /**
     * 獲取用戶郵箱
     */
    async fetchUserEmail(accessToken?: string): Promise<string | null> {
        const token = accessToken || (await this.getValidAccessToken());
        if (!token) {
            return null;
        }

        return new Promise((resolve) => {
            const url = new URL(OAUTH_CONFIG.USERINFO_URL);

            const req = https.request(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', async () => {
                    try {
                        const json = JSON.parse(data);
                        if (json.email) {
                            // 更新儲存的 email
                            const credential = await credentialStorage.getCredential();
                            if (credential) {
                                await credentialStorage.saveCredential({
                                    ...credential,
                                    email: json.email,
                                });
                            }
                            resolve(json.email);
                        } else {
                            resolve(null);
                        }
                    } catch {
                        resolve(null);
                    }
                });
            });

            req.on('error', () => resolve(null));
            req.end();
        });
    }

    /**
     * 建立授權 URL
     */
    private buildAuthUrl(clientId: string, port: number): string {
        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: `http://localhost:${port}/callback`,
            response_type: 'code',
            scope: OAUTH_CONFIG.SCOPES.join(' '),
            access_type: 'offline',
            prompt: 'consent',
        });

        return `${OAUTH_CONFIG.AUTH_URL}?${params.toString()}`;
    }

    /**
     * 啟動本地回呼伺服器
     */
    private startCallbackServer(): Promise<{ port: number; codePromise: Promise<string | null> }> {
        return new Promise((resolve, reject) => {
            let codeResolve: (value: string | null) => void;
            const codePromise = new Promise<string | null>(r => codeResolve = r);

            const server = http.createServer((req, res) => {
                const url = new URL(req.url || '', `http://localhost`);

                if (url.pathname === '/callback') {
                    const code = url.searchParams.get('code');
                    const error = url.searchParams.get('error');

                    if (error) {
                        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                        res.end('<h1>授權失敗</h1><p>您可以關閉此視窗。</p>');
                        codeResolve(null);
                    } else if (code) {
                        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                        res.end('<h1>授權成功！</h1><p>您可以關閉此視窗並返回 VS Code。</p>');
                        codeResolve(code);
                    }
                }
            });

            server.listen(0, '127.0.0.1', () => {
                const address = server.address();
                if (address && typeof address !== 'string') {
                    this.callbackServer = server;
                    resolve({ port: address.port, codePromise });
                } else {
                    reject(new Error('Failed to start callback server'));
                }
            });

            server.on('error', reject);

            // 60 秒超時
            setTimeout(() => {
                codeResolve(null);
            }, 60000);
        });
    }

    /**
     * 停止回呼伺服器
     */
    private stopCallbackServer(): void {
        if (this.callbackServer) {
            this.callbackServer.close();
            this.callbackServer = undefined;
        }
    }

    /**
     * 交換授權碼為 Token
     */
    private async exchangeCodeForToken(
        code: string,
        clientId: string,
        clientSecret: string,
        port: number
    ): Promise<boolean> {
        return new Promise((resolve) => {
            const postData = new URLSearchParams({
                code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: `http://localhost:${port}/callback`,
                grant_type: 'authorization_code',
            }).toString();

            const req = https.request(OAUTH_CONFIG.TOKEN_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(postData),
                },
            }, async (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', async () => {
                    try {
                        const json = JSON.parse(data);
                        if (json.access_token) {
                            const expiresAt = new Date(Date.now() + (json.expires_in || 3600) * 1000).toISOString();

                            const credential: OAuthCredential = {
                                clientId,
                                clientSecret,
                                accessToken: json.access_token,
                                refreshToken: json.refresh_token || '',
                                expiresAt,
                                scopes: OAUTH_CONFIG.SCOPES,
                            };

                            await credentialStorage.saveCredential(credential);
                            this.logger.info('[OAuthService] Authorization successful');
                            vscode.window.showInformationMessage('✅ Auto Wake-up 授權成功！');
                            resolve(true);
                        } else {
                            this.logger.error(`[OAuthService] Token exchange failed: ${json.error || 'unknown'}`);
                            resolve(false);
                        }
                    } catch {
                        resolve(false);
                    }
                });
            });

            req.on('error', () => resolve(false));
            req.write(postData);
            req.end();
        });
    }
}

// 匯出工廠函式
export function createOAuthService(logger: Logger): OAuthService {
    return new OAuthService(logger);
}
