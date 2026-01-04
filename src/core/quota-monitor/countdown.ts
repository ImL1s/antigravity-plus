/**
 * 倒數計時工具
 * 
 * 參考 Antigravity Cockpit 的倒數計時功能
 */

import { t } from '../../i18n';

export interface CountdownResult {
    text: string;
    shortText: string;
    isExpired: boolean;
    totalSeconds: number;
}

/**
 * 計算倒數計時
 */
export function calculateCountdown(resetTime: Date): CountdownResult {
    const now = Date.now();
    const diff = resetTime.getTime() - now;

    if (diff <= 0) {
        return {
            text: t('countdown.reset'),
            shortText: t('countdown.reset'),
            isExpired: true,
            totalSeconds: 0
        };
    }

    const totalSeconds = Math.floor(diff / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    let text: string;
    let shortText: string;

    if (hours > 0) {
        text = t('countdown.hours', hours, minutes);
        shortText = `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
        text = t('countdown.minutes', minutes);
        shortText = `${minutes}m`;
    } else {
        text = `${seconds}s`;
        shortText = `${seconds}s`;
    }

    return {
        text,
        shortText,
        isExpired: false,
        totalSeconds
    };
}

/**
 * 格式化重置時間為本地時間
 */
export function formatResetTime(resetTime: Date): string {
    return resetTime.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * 格式化剩餘時間為可讀格式
 */
export function formatDuration(seconds: number): string {
    if (seconds < 60) {
        return `${seconds}s`;
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }

    return `${minutes}m`;
}

/**
 * 建立自動更新的倒數計時器
 */
export class CountdownTimer {
    private intervalId: NodeJS.Timeout | null = null;
    private callback: ((result: CountdownResult) => void) | null = null;

    constructor(
        private resetTime: Date,
        private updateInterval: number = 1000
    ) { }

    /**
     * 開始倒數
     */
    public start(callback: (result: CountdownResult) => void): void {
        this.callback = callback;
        this.tick();

        this.intervalId = setInterval(() => {
            this.tick();
        }, this.updateInterval);
    }

    /**
     * 執行一次更新
     */
    private tick(): void {
        if (!this.callback) return;

        const result = calculateCountdown(this.resetTime);
        this.callback(result);

        if (result.isExpired && this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    /**
     * 停止倒數
     */
    public stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.callback = null;
    }

    /**
     * 更新重置時間
     */
    public updateResetTime(resetTime: Date): void {
        this.resetTime = resetTime;
    }

    /**
     * 是否正在運行
     */
    public isRunning(): boolean {
        return this.intervalId !== null;
    }
}
