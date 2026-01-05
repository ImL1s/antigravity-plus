/**
 * Impact Tracker - 影響統計追蹤器
 * 
 * 記錄 Auto Accept 節省的點擊數、時間等統計
 * 每週日重置
 */

import * as vscode from 'vscode';

export interface AgentActivity {
    timestamp: Date;
    type: 'click' | 'blocked' | 'session' | 'wakeup' | 'optimization';
    description: string;
}

export interface ImpactStats {
    clicksSaved: number;
    timesSavedMs: number;
    sessions: number;
    blocked: number;
    weekStart: Date;
    activityLog?: AgentActivity[];
}

const STORAGE_KEY = 'antigravity-plus.impactStats';
const MS_PER_CLICK = 2000; // 每次點擊節省約 2 秒
const MAX_ACTIVITY_LOG = 50;

export class ImpactTracker implements vscode.Disposable {
    private stats: ImpactStats;
    private currentSessionId: string | null = null;
    private sessionStartTime: Date | null = null;

    constructor(private context: vscode.ExtensionContext) {
        this.stats = this.loadStats();
        this.checkWeeklyReset();
    }

    /**
     * 記錄活動日誌
     */
    public logActivity(type: AgentActivity['type'], description: string): void {
        if (!this.stats.activityLog) {
            this.stats.activityLog = [];
        }

        this.stats.activityLog.unshift({
            timestamp: new Date(),
            type,
            description
        });

        // 限制長度
        if (this.stats.activityLog.length > MAX_ACTIVITY_LOG) {
            this.stats.activityLog = this.stats.activityLog.slice(0, MAX_ACTIVITY_LOG);
        }
    }

    /**
     * 記錄一次自動點擊
     */
    public recordClick(): void {
        this.stats.clicksSaved++;
        this.stats.timesSavedMs += MS_PER_CLICK;
        this.logActivity('click', '自動核准了一個 Agent 請求');
        this.saveStats();
    }

    /**
     * 記錄多次自動點擊
     */
    public recordClicks(count: number): void {
        this.stats.clicksSaved += count;
        this.stats.timesSavedMs += count * MS_PER_CLICK;
        this.logActivity('click', `自動核准了 ${count} 個 Agent 請求`);
        this.saveStats();
    }

    /**
     * 記錄一次阻擋
     */
    public recordBlocked(): void {
        this.stats.blocked++;
        this.logActivity('blocked', '阻擋了一個潛在的危險指令');
        this.saveStats();
    }

    /**
     * 開始新的 session
     */
    public startSession(): string {
        const sessionId = Date.now().toString(36);
        this.currentSessionId = sessionId;
        this.sessionStartTime = new Date();
        this.stats.sessions++;
        this.logActivity('session', '開始新的開發 Session');
        this.saveStats();
        return sessionId;
    }

    /**
     * 結束當前 session
     */
    public endSession(): void {
        this.currentSessionId = null;
        this.sessionStartTime = null;
    }

    /**
     * 取得當前統計
     */
    public getStats(): ImpactStats {
        return { ...this.stats };
    }

    /**
     * 取得格式化的時間節省
     */
    public getFormattedTimeSaved(): string {
        const totalMinutes = Math.floor(this.stats.timesSavedMs / 60000);

        if (totalMinutes < 60) {
            return `${totalMinutes} minutes`;
        }

        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;

        if (minutes === 0) {
            return `${hours} hours`;
        }

        return `${hours}h ${minutes}m`;
    }

    /**
     * 取得距離重置的時間
     */
    public getTimeUntilReset(): string {
        const now = new Date();
        const nextSunday = this.getNextSunday();
        const diff = nextSunday.getTime() - now.getTime();

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) {
            return 'Today';
        } else if (days === 1) {
            return 'Tomorrow';
        }

        return `${days} days`;
    }

    /**
     * 檢查是否需要每週重置
     */
    private checkWeeklyReset(): void {
        const now = new Date();
        const weekStart = new Date(this.stats.weekStart);

        // 計算當前週的開始（週日）
        const currentWeekStart = this.getWeekStart(now);

        if (weekStart < currentWeekStart) {
            // 需要重置
            this.resetStats();
        }
    }

    /**
     * 取得某日期所在週的週日
     */
    private getWeekStart(date: Date): Date {
        const d = new Date(date);
        const day = d.getDay();
        d.setDate(d.getDate() - day);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    /**
     * 取得下一個週日
     */
    private getNextSunday(): Date {
        const now = new Date();
        const day = now.getDay();
        const daysUntilSunday = day === 0 ? 7 : 7 - day;
        const nextSunday = new Date(now);
        nextSunday.setDate(now.getDate() + daysUntilSunday);
        nextSunday.setHours(0, 0, 0, 0);
        return nextSunday;
    }

    /**
     * 重置統計
     */
    public resetStats(): void {
        this.stats = {
            clicksSaved: 0,
            timesSavedMs: 0,
            sessions: 0,
            blocked: 0,
            weekStart: this.getWeekStart(new Date())
        };
        this.saveStats();
    }

    /**
     * 載入統計
     */
    private loadStats(): ImpactStats {
        const saved = this.context.globalState.get<ImpactStats>(STORAGE_KEY);

        if (saved) {
            return {
                ...saved,
                weekStart: new Date(saved.weekStart)
            };
        }

        return {
            clicksSaved: 0,
            timesSavedMs: 0,
            sessions: 0,
            blocked: 0,
            weekStart: this.getWeekStart(new Date())
        };
    }

    /**
     * 儲存統計
     */
    private saveStats(): void {
        this.context.globalState.update(STORAGE_KEY, this.stats);
    }

    /**
     * 釋放資源
     */
    public dispose(): void {
        this.saveStats();
    }
}
