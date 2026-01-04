/**
 * Wakeup Scheduler - 常駐排程器
 * 
 * 在 VS Code 開啟時執行的排程
 */

import { Logger } from '../../utils/logger';

export class WakeupScheduler {
    private timeoutId: NodeJS.Timeout | null = null;
    private onTriggerCallback: (() => void) | null = null;
    private scheduledTime: Date | null = null;

    constructor(private logger: Logger) { }

    /**
     * 排程在指定時間觸發
     */
    public schedule(time: Date): void {
        this.cancel();

        const now = Date.now();
        const delay = time.getTime() - now;

        if (delay <= 0) {
            this.logger.warn('排程時間已過，將在 1 分鐘後執行');
            this.scheduleWithDelay(60000);
            return;
        }

        this.scheduledTime = time;
        this.scheduleWithDelay(delay);
    }

    /**
     * 使用延遲毫秒數排程
     */
    private scheduleWithDelay(delayMs: number): void {
        // Node.js setTimeout 最大約 24.8 天
        const MAX_DELAY = 2147483647;

        if (delayMs > MAX_DELAY) {
            // 分段排程
            this.timeoutId = setTimeout(() => {
                const remaining = delayMs - MAX_DELAY;
                this.scheduleWithDelay(remaining);
            }, MAX_DELAY);
        } else {
            this.timeoutId = setTimeout(() => {
                this.trigger();
            }, delayMs);
        }

        this.logger.debug(`排程已設定，將在 ${Math.round(delayMs / 1000)} 秒後觸發`);
    }

    /**
     * 觸發回調
     */
    private trigger(): void {
        this.timeoutId = null;
        this.scheduledTime = null;

        if (this.onTriggerCallback) {
            this.onTriggerCallback();
        }
    }

    /**
     * 取消排程
     */
    public cancel(): void {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        this.scheduledTime = null;
    }

    /**
     * 設定觸發回調
     */
    public onTrigger(callback: () => void): void {
        this.onTriggerCallback = callback;
    }

    /**
     * 取得下次觸發時間
     */
    public getScheduledTime(): Date | null {
        return this.scheduledTime;
    }

    /**
     * 是否有排程中
     */
    public isScheduled(): boolean {
        return this.timeoutId !== null;
    }

    /**
     * 取得距離下次觸發的時間
     */
    public getTimeUntilTrigger(): number | null {
        if (!this.scheduledTime) {
            return null;
        }
        return Math.max(0, this.scheduledTime.getTime() - Date.now());
    }

    /**
     * 釋放資源
     */
    public dispose(): void {
        this.cancel();
        this.onTriggerCallback = null;
    }
}
