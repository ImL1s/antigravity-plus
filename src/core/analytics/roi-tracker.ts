/**
 * ROI 追蹤器 - 記錄 Auto Accept 的使用統計
 * 
 * 參考 MunKhin/auto-accept-agent 的 ROI Stats 實作
 * 追蹤點擊次數、阻擋次數、節省時間等統計數據
 */

import * as vscode from 'vscode';
import { Logger } from '../../utils/logger';

// 存儲鍵
const ROI_STATS_KEY = 'antigravity-plus-roi-stats';
const SECONDS_PER_CLICK = 5; // 保守估計：每次自動接受節省 5 秒

export interface ROIStats {
    weekStart: number;           // 週起始時間戳
    clicksThisWeek: number;      // 本週點擊次數
    blockedThisWeek: number;     // 本週阻擋次數
    sessionsThisWeek: number;    // 本週工作階段數
    fileEditsThisWeek: number;   // 本週檔案編輯次數
    terminalCommandsThisWeek: number; // 本週終端指令次數
    actionsWhileAway: number;    // 使用者離開時的操作次數
}

export interface SessionSummary {
    clicks: number;
    fileEdits: number;
    terminalCommands: number;
    blocked: number;
    estimatedTimeSaved: string | null;
}

export class ROITracker implements vscode.Disposable {
    private context: vscode.ExtensionContext | null = null;
    private sessionStats = {
        clicksThisSession: 0,
        blockedThisSession: 0,
        fileEditsThisSession: 0,
        terminalCommandsThisSession: 0,
        actionsWhileAway: 0,
        sessionStartTime: Date.now()
    };
    private isWindowFocused = true;

    constructor(private logger: Logger) { }

    /**
     * 初始化
     */
    public initialize(context: vscode.ExtensionContext): void {
        this.context = context;
        this.resetSessionStats();
        this.logger.debug('[ROITracker] Initialized');
    }

    /**
     * 取得週起始時間（週日 00:00）
     */
    private getWeekStart(): number {
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0 = 週日
        const diff = now.getDate() - dayOfWeek;
        const weekStart = new Date(now.setDate(diff));
        weekStart.setHours(0, 0, 0, 0);
        return weekStart.getTime();
    }

    /**
     * 載入 ROI 統計（如果是新的一週，會自動重置）
     */
    public async loadStats(): Promise<ROIStats> {
        if (!this.context) {
            return this.createDefaultStats();
        }

        const defaultStats = this.createDefaultStats();
        let stats = this.context.globalState.get<ROIStats>(ROI_STATS_KEY, defaultStats);

        // 檢查是否需要為新的一週重置
        const currentWeekStart = this.getWeekStart();
        if (stats.weekStart !== currentWeekStart) {
            this.logger.info('[ROITracker] New week detected, showing summary and resetting...');

            // 如果有有意義的統計資料，顯示每週摘要
            if (stats.clicksThisWeek > 0) {
                await this.showWeeklySummaryNotification(stats);
            }

            // 重置為新的一週
            stats = { ...defaultStats, weekStart: currentWeekStart };
            await this.saveStats(stats);
        }

        return stats;
    }

    /**
     * 建立預設統計
     */
    private createDefaultStats(): ROIStats {
        return {
            weekStart: this.getWeekStart(),
            clicksThisWeek: 0,
            blockedThisWeek: 0,
            sessionsThisWeek: 0,
            fileEditsThisWeek: 0,
            terminalCommandsThisWeek: 0,
            actionsWhileAway: 0
        };
    }

    /**
     * 儲存統計
     */
    private async saveStats(stats: ROIStats): Promise<void> {
        if (!this.context) {
            return;
        }
        await this.context.globalState.update(ROI_STATS_KEY, stats);
    }

    /**
     * 記錄一次點擊
     */
    public async trackClick(category: 'file_edit' | 'terminal_command'): Promise<void> {
        this.sessionStats.clicksThisSession++;

        if (category === 'terminal_command') {
            this.sessionStats.terminalCommandsThisSession++;
        } else {
            this.sessionStats.fileEditsThisSession++;
        }

        // 如果視窗沒有焦點，記錄為離開時的操作
        if (!this.isWindowFocused) {
            this.sessionStats.actionsWhileAway++;
        }

        this.logger.debug(`[ROITracker] Click tracked: ${category}. Total: ${this.sessionStats.clicksThisSession}`);
    }

    /**
     * 記錄一次阻擋
     */
    public trackBlocked(): void {
        this.sessionStats.blockedThisSession++;
        this.logger.debug(`[ROITracker] Blocked. Total: ${this.sessionStats.blockedThisSession}`);
    }

    /**
     * 設定視窗焦點狀態
     */
    public setFocusState(isFocused: boolean): void {
        this.isWindowFocused = isFocused;
    }

    /**
     * 取得並消費離開時的操作數
     */
    public consumeAwayActions(): number {
        const count = this.sessionStats.actionsWhileAway;
        this.sessionStats.actionsWhileAway = 0;
        return count;
    }

    /**
     * 收集並儲存工作階段統計到全域統計
     */
    public async collectAndSaveStats(): Promise<void> {
        if (!this.context) {
            return;
        }

        const stats = await this.loadStats();

        if (this.sessionStats.clicksThisSession > 0 || this.sessionStats.blockedThisSession > 0) {
            stats.clicksThisWeek += this.sessionStats.clicksThisSession;
            stats.blockedThisWeek += this.sessionStats.blockedThisSession;
            stats.fileEditsThisWeek += this.sessionStats.fileEditsThisSession;
            stats.terminalCommandsThisWeek += this.sessionStats.terminalCommandsThisSession;

            await this.saveStats(stats);
            this.logger.info(`[ROITracker] Stats collected: +${this.sessionStats.clicksThisSession} clicks, +${this.sessionStats.blockedThisSession} blocked`);
        }

        this.resetSessionStats();
    }

    /**
     * 增加工作階段計數
     */
    public async incrementSessionCount(): Promise<void> {
        if (!this.context) {
            return;
        }

        const stats = await this.loadStats();
        stats.sessionsThisWeek++;
        await this.saveStats(stats);
        this.logger.debug(`[ROITracker] Session count incremented to ${stats.sessionsThisWeek}`);
    }

    /**
     * 取得工作階段摘要
     */
    public getSessionSummary(): SessionSummary {
        const clicks = this.sessionStats.clicksThisSession;
        const baseSecs = clicks * SECONDS_PER_CLICK;
        const minMins = Math.max(1, Math.floor((baseSecs * 0.8) / 60));
        const maxMins = Math.ceil((baseSecs * 1.2) / 60);

        return {
            clicks,
            fileEdits: this.sessionStats.fileEditsThisSession,
            terminalCommands: this.sessionStats.terminalCommandsThisSession,
            blocked: this.sessionStats.blockedThisSession,
            estimatedTimeSaved: clicks > 0 ? `${minMins}–${maxMins}` : null
        };
    }

    /**
     * 重置工作階段統計
     */
    private resetSessionStats(): void {
        this.sessionStats = {
            clicksThisSession: 0,
            blockedThisSession: 0,
            fileEditsThisSession: 0,
            terminalCommandsThisSession: 0,
            actionsWhileAway: 0,
            sessionStartTime: Date.now()
        };
    }

    /**
     * 顯示每週摘要通知
     */
    private async showWeeklySummaryNotification(lastWeekStats: ROIStats): Promise<void> {
        const timeSavedSeconds = lastWeekStats.clicksThisWeek * SECONDS_PER_CLICK;
        const timeSavedMinutes = Math.round(timeSavedSeconds / 60);

        let timeStr: string;
        if (timeSavedMinutes >= 60) {
            timeStr = `${(timeSavedMinutes / 60).toFixed(1)} 小時`;
        } else {
            timeStr = `${timeSavedMinutes} 分鐘`;
        }

        const message = `📊 上週 Auto Accept 為您節省了 ${timeStr}，自動處理了 ${lastWeekStats.clicksThisWeek} 次操作！`;

        const choice = await vscode.window.showInformationMessage(
            message,
            '查看詳情'
        );

        if (choice === '查看詳情') {
            vscode.commands.executeCommand('antigravity-plus.openDashboard');
        }
    }

    /**
     * 顯示工作階段摘要通知
     */
    public async showSessionSummaryNotification(): Promise<void> {
        const summary = this.getSessionSummary();

        if (summary.clicks === 0) {
            return;
        }

        const lines = [
            `✅ 本次工作階段：`,
            `• ${summary.clicks} 次操作已自動接受`,
            `• ${summary.terminalCommands} 次終端指令`,
            `• ${summary.fileEdits} 次檔案編輯`,
            `• ${summary.blocked} 次阻擋`
        ];

        if (summary.estimatedTimeSaved) {
            lines.push(`⏱ 預估節省時間：~${summary.estimatedTimeSaved} 分鐘`);
        }

        vscode.window.showInformationMessage(
            `🤖 Auto Accept: ${summary.clicks} 次操作已處理`,
            '查看統計'
        ).then(choice => {
            if (choice === '查看統計') {
                vscode.commands.executeCommand('antigravity-plus.openDashboard');
            }
        });
    }

    /**
     * 顯示離開時操作通知
     */
    public async showAwayActionsNotification(actionsCount: number): Promise<void> {
        if (actionsCount === 0) {
            return;
        }

        const message = `🚀 Auto Accept 在您離開時處理了 ${actionsCount} 次操作。`;

        vscode.window.showInformationMessage(
            message,
            '查看詳情'
        ).then(choice => {
            if (choice === '查看詳情') {
                vscode.commands.executeCommand('antigravity-plus.openDashboard');
            }
        });
    }

    /**
     * 取得 ROI 統計（給 Dashboard 使用）
     */
    public async getROIStats(): Promise<{
        clicksThisWeek: number;
        blockedThisWeek: number;
        sessionsThisWeek: number;
        timeSavedFormatted: string;
    }> {
        const stats = await this.loadStats();
        const timeSavedMinutes = Math.round((stats.clicksThisWeek * SECONDS_PER_CLICK) / 60);

        return {
            clicksThisWeek: stats.clicksThisWeek,
            blockedThisWeek: stats.blockedThisWeek,
            sessionsThisWeek: stats.sessionsThisWeek,
            timeSavedFormatted: timeSavedMinutes >= 60
                ? `${(timeSavedMinutes / 60).toFixed(1)} 小時`
                : `${timeSavedMinutes} 分鐘`
        };
    }

    /**
     * 釋放資源
     */
    public dispose(): void {
        // 儲存最終統計
        this.collectAndSaveStats();
    }
}
