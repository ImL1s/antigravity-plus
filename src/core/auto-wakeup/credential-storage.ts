/**
 * Credential Storage - 憑證加密儲存
 * 
 * 對齊 antigravity-cockpit 的 auto_trigger/credential_storage.ts
 * 使用 VS Code Secret Storage 安全儲存 OAuth 憑證
 */

import * as vscode from 'vscode';
import { OAuthCredential } from './types';

const CREDENTIAL_KEY = 'antigravity-plus.oauthCredential';

/**
 * 憑證儲存服務
 */
export class CredentialStorage {
    private context: vscode.ExtensionContext | undefined;
    private cachedCredential: OAuthCredential | undefined;

    /**
     * 初始化儲存 (需要 Extension Context)
     */
    initialize(context: vscode.ExtensionContext): void {
        this.context = context;
        // 預載入憑證到快取
        this.loadCredential().catch(() => {
            // 忽略載入錯誤
        });
    }

    /**
     * 儲存憑證
     */
    async saveCredential(credential: OAuthCredential): Promise<void> {
        if (!this.context) {
            throw new Error('CredentialStorage not initialized');
        }

        await this.context.secrets.store(CREDENTIAL_KEY, JSON.stringify(credential));
        this.cachedCredential = credential;
    }

    /**
     * 獲取憑證
     */
    async getCredential(): Promise<OAuthCredential | undefined> {
        if (this.cachedCredential) {
            return this.cachedCredential;
        }

        return this.loadCredential();
    }

    /**
     * 從儲存載入憑證
     */
    private async loadCredential(): Promise<OAuthCredential | undefined> {
        if (!this.context) {
            return undefined;
        }

        try {
            const stored = await this.context.secrets.get(CREDENTIAL_KEY);
            if (stored) {
                this.cachedCredential = JSON.parse(stored);
                return this.cachedCredential;
            }
        } catch {
            // 解析失敗，清除無效資料
            await this.clearCredential();
        }

        return undefined;
    }

    /**
     * 清除憑證
     */
    async clearCredential(): Promise<void> {
        if (!this.context) {
            return;
        }

        await this.context.secrets.delete(CREDENTIAL_KEY);
        this.cachedCredential = undefined;
    }

    /**
     * 檢查是否有憑證
     */
    async hasCredential(): Promise<boolean> {
        const credential = await this.getCredential();
        return Boolean(credential?.accessToken);
    }

    /**
     * 更新 Access Token (用於刷新)
     */
    async updateAccessToken(accessToken: string, expiresAt: string): Promise<void> {
        const credential = await this.getCredential();
        if (!credential) {
            throw new Error('No credential to update');
        }

        credential.accessToken = accessToken;
        credential.expiresAt = expiresAt;
        await this.saveCredential(credential);
    }

    /**
     * 更新 Project ID
     */
    async updateProjectId(projectId: string): Promise<void> {
        const credential = await this.getCredential();
        if (!credential) {
            return;
        }

        credential.projectId = projectId;
        await this.saveCredential(credential);
    }

    /**
     * 獲取 Access Token (便捷方法)
     */
    async getAccessToken(): Promise<string | undefined> {
        const credential = await this.getCredential();
        return credential?.accessToken;
    }

    /**
     * 獲取 Refresh Token (便捷方法)
     */
    async getRefreshToken(): Promise<string | undefined> {
        const credential = await this.getCredential();
        return credential?.refreshToken;
    }

    /**
     * 檢查 Token 是否過期
     */
    async isTokenExpired(): Promise<boolean> {
        const credential = await this.getCredential();
        if (!credential?.expiresAt) {
            return true;
        }

        const expiresAt = new Date(credential.expiresAt).getTime();
        // 提前 5 分鐘視為過期
        const bufferMs = 5 * 60 * 1000;
        return Date.now() > (expiresAt - bufferMs);
    }
}

// 匯出單例
export const credentialStorage = new CredentialStorage();
