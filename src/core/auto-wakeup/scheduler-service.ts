/**
 * Scheduler Service - 排程服務
 * 
 * 對齊 antigravity-cockpit 的 auto_trigger/scheduler_service.ts
 * 支援 daily/weekly/interval 模式和 crontab
 */

import {
    ScheduleConfig,
    ScheduleRepeatMode,
    CrontabParseResult,
    DEFAULT_SCHEDULE_CONFIG
} from './types';
import { Logger } from '../../utils/logger';

/**
 * 排程服務
 * 負責計算下次觸發時間
 */
export class SchedulerService {
    private config: ScheduleConfig = { ...DEFAULT_SCHEDULE_CONFIG };
    private timeoutId: NodeJS.Timeout | null = null;
    private onTriggerCallback: (() => Promise<void>) | null = null;
    private scheduledTime: Date | null = null;

    constructor(private logger: Logger) { }

    /**
     * 設定排程配置
     */
    setConfig(config: ScheduleConfig): void {
        this.config = { ...config };
        if (config.enabled) {
            this.scheduleNext();
        } else {
            this.cancel();
        }
    }

    /**
     * 獲取當前配置
     */
    getConfig(): ScheduleConfig {
        return { ...this.config };
    }

    /**
     * 設定觸發回調
     */
    onTrigger(callback: () => Promise<void>): void {
        this.onTriggerCallback = callback;
    }

    /**
     * 排程下次觸發
     */
    scheduleNext(): void {
        this.cancel();

        if (!this.config.enabled) {
            return;
        }

        const nextTime = this.calculateNextTriggerTime();
        if (!nextTime) {
            this.logger.warn('[SchedulerService] Unable to calculate next trigger time');
            return;
        }

        this.scheduledTime = nextTime;
        const delay = nextTime.getTime() - Date.now();

        if (delay <= 0) {
            this.logger.info('[SchedulerService] Trigger time already passed, triggering immediately');
            this.triggerNow();
            return;
        }

        this.scheduleWithDelay(delay);
        this.logger.info(`[SchedulerService] Next trigger scheduled at ${nextTime.toLocaleString()}`);
    }

    /**
     * 使用延遲毫秒數排程
     */
    private scheduleWithDelay(delayMs: number): void {
        const MAX_DELAY = 2147483647;

        if (delayMs > MAX_DELAY) {
            this.timeoutId = setTimeout(() => {
                const remaining = delayMs - MAX_DELAY;
                this.scheduleWithDelay(remaining);
            }, MAX_DELAY);
        } else {
            this.timeoutId = setTimeout(() => {
                this.triggerNow();
            }, delayMs);
        }
    }

    /**
     * 立即觸發
     */
    private async triggerNow(): Promise<void> {
        this.timeoutId = null;
        this.scheduledTime = null;

        if (this.onTriggerCallback) {
            try {
                await this.onTriggerCallback();
            } catch (error) {
                this.logger.error(`[SchedulerService] Trigger callback error: ${error}`);
            }
        }

        // 排程下一次
        if (this.config.enabled) {
            this.scheduleNext();
        }
    }

    /**
     * 計算下次觸發時間
     */
    calculateNextTriggerTime(fromTime?: Date): Date | null {
        const now = fromTime || new Date();

        switch (this.config.repeatMode) {
            case 'daily':
                return this.calculateDailyNext(now);
            case 'weekly':
                return this.calculateWeeklyNext(now);
            case 'interval':
                return this.calculateIntervalNext(now);
            default:
                // 嘗試使用 crontab
                if (this.config.crontab) {
                    return this.parseCrontabNext(this.config.crontab, now);
                }
                return null;
        }
    }

    /**
     * 計算每日模式的下次觸發時間
     */
    private calculateDailyNext(now: Date): Date | null {
        const times = this.config.dailyTimes || ['07:00'];
        if (times.length === 0) {
            return null;
        }

        // 解析所有時間並排序
        const todayTimes = times
            .map(t => this.parseTimeString(t, now))
            .filter(Boolean)
            .sort((a, b) => a!.getTime() - b!.getTime());

        // 找到今天尚未過的時間
        for (const time of todayTimes) {
            if (time && time > now) {
                return time;
            }
        }

        // 今天都過了，取明天的第一個時間
        if (todayTimes[0]) {
            const tomorrow = new Date(todayTimes[0]);
            tomorrow.setDate(tomorrow.getDate() + 1);
            return tomorrow;
        }

        return null;
    }

    /**
     * 計算每週模式的下次觸發時間
     */
    private calculateWeeklyNext(now: Date): Date | null {
        const days = this.config.weeklyDays || [1, 2, 3, 4, 5]; // 預設工作日
        const times = this.config.weeklyTimes || ['08:00'];

        if (days.length === 0 || times.length === 0) {
            return null;
        }

        // 檢查接下來 7 天
        for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
            const checkDate = new Date(now);
            checkDate.setDate(checkDate.getDate() + dayOffset);
            const dayOfWeek = checkDate.getDay();

            if (days.includes(dayOfWeek)) {
                // 這天在排程日期內
                for (const timeStr of times.sort()) {
                    const triggerTime = this.parseTimeString(timeStr, checkDate);
                    if (triggerTime && triggerTime > now) {
                        return triggerTime;
                    }
                }
            }
        }

        // 找不到，回到下週第一個
        const nextWeek = new Date(now);
        nextWeek.setDate(nextWeek.getDate() + 7);
        return this.calculateWeeklyNext(nextWeek);
    }

    /**
     * 計算間隔模式的下次觸發時間
     */
    private calculateIntervalNext(now: Date): Date | null {
        const hours = this.config.intervalHours || 4;
        const startTime = this.config.intervalStartTime || '07:00';
        const endTime = this.config.intervalEndTime; // 可選

        // 解析開始時間
        const [startHour, startMinute] = startTime.split(':').map(Number);

        // 今天的開始時間
        const todayStart = new Date(now);
        todayStart.setHours(startHour, startMinute, 0, 0);

        // 如果有結束時間，檢查是否在時間範圍內
        let todayEnd: Date | null = null;
        if (endTime) {
            const [endHour, endMinute] = endTime.split(':').map(Number);
            todayEnd = new Date(now);
            todayEnd.setHours(endHour, endMinute, 0, 0);
        }

        // 計算從今天開始時間算起的間隔
        const msPerHour = 60 * 60 * 1000;
        const intervalMs = hours * msPerHour;

        let nextTrigger: Date;

        if (now < todayStart) {
            // 還沒到開始時間，下次就在開始時間
            nextTrigger = todayStart;
        } else {
            // 計算從開始時間起經過了多少個間隔
            const elapsed = now.getTime() - todayStart.getTime();
            const intervals = Math.floor(elapsed / intervalMs);
            nextTrigger = new Date(todayStart.getTime() + (intervals + 1) * intervalMs);
        }

        // 檢查是否超過結束時間
        if (todayEnd && nextTrigger > todayEnd) {
            // 明天開始
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(startHour, startMinute, 0, 0);
            return tomorrow;
        }

        return nextTrigger;
    }

    /**
     * 解析時間字串為 Date
     */
    private parseTimeString(timeStr: string, date: Date): Date | null {
        const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
        if (!match) {
            return null;
        }

        const hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);

        const result = new Date(date);
        result.setHours(hours, minutes, 0, 0);
        return result;
    }

    /**
     * 解析 Crontab 表達式並計算下次觸發時間
     * 簡化版：只支援基本格式 (minute hour day month dayOfWeek)
     */
    private parseCrontabNext(crontab: string, now: Date): Date | null {
        const result = this.parseCrontab(crontab);
        if (!result.valid || !result.nextRuns || result.nextRuns.length === 0) {
            return null;
        }
        return result.nextRuns[0];
    }

    /**
     * 驗證並解析 Crontab 表達式
     */
    parseCrontab(crontab: string): CrontabParseResult {
        const parts = crontab.trim().split(/\s+/);
        if (parts.length !== 5) {
            return { valid: false, error: 'Crontab 應該有 5 個欄位: minute hour day month dayOfWeek' };
        }

        try {
            const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

            // 簡化解析：只支援特定值或 *
            const parseField = (field: string, min: number, max: number): number[] => {
                if (field === '*') {
                    return Array.from({ length: max - min + 1 }, (_, i) => min + i);
                }
                if (field.includes(',')) {
                    return field.split(',').map(Number);
                }
                if (field.includes('-')) {
                    const [start, end] = field.split('-').map(Number);
                    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
                }
                if (field.includes('/')) {
                    const [, step] = field.split('/');
                    const stepNum = parseInt(step, 10);
                    return Array.from({ length: Math.floor((max - min) / stepNum) + 1 }, (_, i) => min + i * stepNum);
                }
                return [parseInt(field, 10)];
            };

            const minutes = parseField(minute, 0, 59);
            const hours = parseField(hour, 0, 23);
            const daysOfMonth = parseField(dayOfMonth, 1, 31);
            const months = parseField(month, 1, 12);
            const daysOfWeek = parseField(dayOfWeek, 0, 6);

            // 計算接下來的幾次運行時間
            const nextRuns: Date[] = [];
            const now = new Date();
            const searchLimit = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 天內

            for (let date = new Date(now); date < searchLimit && nextRuns.length < 5; date.setMinutes(date.getMinutes() + 1)) {
                if (
                    minutes.includes(date.getMinutes()) &&
                    hours.includes(date.getHours()) &&
                    (dayOfMonth === '*' || daysOfMonth.includes(date.getDate())) &&
                    (month === '*' || months.includes(date.getMonth() + 1)) &&
                    (dayOfWeek === '*' || daysOfWeek.includes(date.getDay()))
                ) {
                    nextRuns.push(new Date(date));
                }
            }

            // 生成描述
            let description = '';
            if (minute === '0' && hour !== '*') {
                description = `每天 ${hours.join(', ')}:00`;
            } else if (dayOfWeek !== '*') {
                const dayNames = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
                const dayStr = daysOfWeek.map(d => dayNames[d]).join(', ');
                description = `${dayStr} ${hours.join(', ')}:${minutes.join(', ')}`;
            } else {
                description = crontab;
            }

            return {
                valid: true,
                description,
                nextRuns,
            };
        } catch (error) {
            return { valid: false, error: String(error) };
        }
    }

    /**
     * 取消排程
     */
    cancel(): void {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        this.scheduledTime = null;
    }

    /**
     * 獲取下次觸發時間
     */
    getScheduledTime(): Date | null {
        return this.scheduledTime;
    }

    /**
     * 獲取下次觸發時間的格式化字串
     */
    getNextRunTimeFormatted(): string | null {
        if (!this.scheduledTime) {
            return null;
        }

        const now = new Date();
        const diff = this.scheduledTime.getTime() - now.getTime();

        if (diff < 60 * 60 * 1000) {
            // 1 小時內
            const minutes = Math.round(diff / 60000);
            return `${minutes} 分鐘後`;
        } else if (diff < 24 * 60 * 60 * 1000) {
            // 24 小時內
            const hours = Math.round(diff / 3600000);
            return `${hours} 小時後`;
        } else {
            // 超過 24 小時
            return this.scheduledTime.toLocaleString();
        }
    }

    /**
     * 獲取排程描述
     */
    describeSchedule(config?: ScheduleConfig): string {
        const c = config || this.config;

        if (!c.enabled) {
            return '已停用';
        }

        switch (c.repeatMode) {
            case 'daily':
                return `每天 ${(c.dailyTimes || []).join(', ')}`;
            case 'weekly': {
                const dayNames = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
                const days = (c.weeklyDays || []).map(d => dayNames[d]).join(', ');
                return `${days} ${(c.weeklyTimes || []).join(', ')}`;
            }
            case 'interval':
                return `每 ${c.intervalHours || 4} 小時 (${c.intervalStartTime || '07:00'} - ${c.intervalEndTime || '23:00'})`;
            default:
                if (c.crontab) {
                    const parsed = this.parseCrontab(c.crontab);
                    return parsed.description || c.crontab;
                }
                return '未知模式';
        }
    }

    /**
     * 釋放資源
     */
    dispose(): void {
        this.cancel();
        this.onTriggerCallback = null;
    }
}

/**
 * 建立 SchedulerService 實例
 */
export function createSchedulerService(logger: Logger): SchedulerService {
    return new SchedulerService(logger);
}
