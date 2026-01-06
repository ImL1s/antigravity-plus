/**
 * Announcement Service - 遠端公告系統
 * 
 * 參考 Antigravity Cockpit 實作
 * 用於發送更新通知、維護公告、或推廣訊息
 */

import * as vscode from 'vscode';
import * as https from 'https';
import { Announcement, AnnouncementLevel, AnnouncementResponse } from './announcement-types';
import { Logger } from '../utils/logger';
import { ConfigManager } from '../utils/config';

const ANNOUNCEMENT_API_URL = 'https://api.antigravity-plus.com/announcements'; // 範例 URL
const DISMISSED_ANNOUNCEMENTS_KEY = 'antigravity-plus.dismissed-announcements';
const CHECK_INTERVAL_MS = 1000 * 60 * 60 * 24; // 每天檢查一次

export class AnnouncementService {
    private isInitialized = false;
    private checkTimer: NodeJS.Timeout | null = null;
    private context: vscode.ExtensionContext | null = null;
    private extensionVersion: string = '0.0.0';

    constructor(
        private logger: Logger,
        private configManager: ConfigManager
    ) { }

    /**
     * 初始化服務
     */
    public initialize(context: vscode.ExtensionContext): void {
        this.context = context;
        const packageJson = context.extension.packageJSON;
        this.extensionVersion = packageJson.version || '0.0.0';

        this.isInitialized = true;
        this.logger.info(`[Announcement] Initialized (v${this.extensionVersion})`);

        // 啟動首次檢查
        this.checkForAnnouncements();

        // 設定定期檢查
        this.checkTimer = setInterval(() => {
            this.checkForAnnouncements();
        }, CHECK_INTERVAL_MS);
    }

    /**
     * 檢查公告
     */
    public async checkForAnnouncements(): Promise<void> {
        if (!this.isInitialized || !this.context) return;

        try {
            this.logger.debug('[Announcement] Checking for updates...');

            // 由於目前沒有實際的 API，這裡使用模擬數據或靜態配置
            // 在實際生產環境中，這裡會是 fetch(ANNOUNCEMENT_API_URL)
            const announcements = await this.fetchAnnouncements();

            await this.processAnnouncements(announcements);

        } catch (error) {
            this.logger.error(`[Announcement] Check failed: ${error}`);
        }
    }

    /**
     * 獲取公告 (目前回傳空陣列，待後端就緒)
     */
    private async fetchAnnouncements(): Promise<Announcement[]> {
        // 模擬延遲
        await new Promise(resolve => setTimeout(resolve, 500));

        // TODO: 實作實際的 API 請求
        // 目前回傳空陣列，避免干擾用戶
        return [];
    }

    /**
     * 處理公告列表
     */
    private async processAnnouncements(announcements: Announcement[]): Promise<void> {
        if (!this.context) return;

        const dismissedIds = this.context.globalState.get<string[]>(DISMISSED_ANNOUNCEMENTS_KEY, []);
        const now = new Date();

        for (const ann of announcements) {
            // 1. 檢查是否已過期
            if (ann.expiresAt && new Date(ann.expiresAt) < now) {
                continue;
            }

            // 2. 檢查是否已忽略
            if (dismissedIds.includes(ann.id)) {
                continue;
            }

            // 3. 檢查版本條件
            if (this.shouldShowForVersion(ann)) {
                await this.showAnnouncement(ann);
            }
        }
    }

    /**
     * 檢查是否符合版本條件
     */
    private shouldShowForVersion(ann: Announcement): boolean {
        // 簡易版本比較邏輯 (SemVer 比較略過，假設格式正確)
        if (ann.minVersion && this.compareVersions(this.extensionVersion, ann.minVersion) < 0) {
            return false;
        }
        if (ann.maxVersion && this.compareVersions(this.extensionVersion, ann.maxVersion) > 0) {
            return false;
        }
        return true;
    }

    /**
     * 顯示公告
     */
    private async showAnnouncement(ann: Announcement): Promise<void> {
        if (!this.context) return;

        const actions: string[] = [];
        if (ann.url) {
            actions.push(ann.urlLabel || '查看詳情');
        }
        actions.push('不再顯示');

        let msgFunc = vscode.window.showInformationMessage;
        if (ann.level === AnnouncementLevel.WARNING) msgFunc = vscode.window.showWarningMessage;
        if (ann.level === AnnouncementLevel.CRITICAL) msgFunc = vscode.window.showErrorMessage;

        const selection = await msgFunc(
            ann.message,
            { detail: ann.detail, modal: ann.level === AnnouncementLevel.CRITICAL },
            ...actions
        );

        if (selection === '不再顯示') {
            await this.dismissAnnouncement(ann.id);
        } else if (selection === (ann.urlLabel || '查看詳情') && ann.url) {
            vscode.env.openExternal(vscode.Uri.parse(ann.url));
        }
    }

    /**
     * 忽略公告
     */
    private async dismissAnnouncement(id: string): Promise<void> {
        if (!this.context) return;
        const dismissedIds = this.context.globalState.get<string[]>(DISMISSED_ANNOUNCEMENTS_KEY, []);
        if (!dismissedIds.includes(id)) {
            dismissedIds.push(id);
            await this.context.globalState.update(DISMISSED_ANNOUNCEMENTS_KEY, dismissedIds);
        }
    }

    /**
     * 版本比較輔助函式 (僅支援主要部分比較)
     * returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
     */
    private compareVersions(v1: string, v2: string): number {
        const p1 = v1.split('.').map(Number);
        const p2 = v2.split('.').map(Number);

        for (let i = 0; i < 3; i++) {
            const n1 = p1[i] || 0;
            const n2 = p2[i] || 0;
            if (n1 > n2) return 1;
            if (n1 < n2) return -1;
        }
        return 0;
    }

    /**
     * 銷毀服務
     */
    public dispose(): void {
        if (this.checkTimer) {
            clearInterval(this.checkTimer);
            this.checkTimer = null;
        }
    }
}
