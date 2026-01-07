/**
 * CronParser - Cron 表達式解析器
 * 
 * 對齊 antigravity-cockpit 的 scheduler_service.ts 中的 CronParser 類
 * 支援標準 5 欄位格式: 分鐘 小時 日 月 星期
 */

import { ScheduleConfig, CrontabParseResult } from './types';

/**
 * Cron 表達式解析器
 * 支援標準 5 欄位格式: 分鐘 小時 日 月 星期
 */
export class CronParser {
    /**
     * 將可視化配置轉換為 crontab 表達式
     */
    static configToCrontab(config: ScheduleConfig): string {
        switch (config.repeatMode) {
            case 'daily':
                return this.dailyToCrontab(config.dailyTimes || []);
            case 'weekly':
                return this.weeklyToCrontab(config.weeklyDays || [], config.weeklyTimes || []);
            case 'interval':
                return this.intervalToCrontab(
                    config.intervalHours || 4,
                    config.intervalStartTime || '00:00',
                    config.intervalEndTime
                );
            default:
                return '0 8 * * *'; // 預設每天 8:00
        }
    }

    /**
     * 每天模式轉 crontab
     * 例如: ["07:00", "12:00", "17:00"] -> "0 7,12,17 * * *"
     * 如果分鐘不同: ["07:00", "09:30"] -> "0 7 * * *;30 9 * * *" (多條表達式用分號分隔)
     */
    static dailyToCrontab(times: string[]): string {
        if (times.length === 0) {
            return '0 8 * * *';
        }

        // 按分鐘分組
        const minuteGroups = new Map<number, number[]>();
        for (const time of times) {
            const [h, m] = time.split(':').map(Number);
            if (!minuteGroups.has(m)) {
                minuteGroups.set(m, []);
            }
            minuteGroups.get(m)!.push(h);
        }

        // 為每個分鐘組生成一條 crontab 表達式
        const expressions: string[] = [];
        for (const [minute, hours] of minuteGroups) {
            const hourList = hours.sort((a, b) => a - b).join(',');
            expressions.push(`${minute} ${hourList} * * *`);
        }

        // 用分號分隔多條表達式
        return expressions.join(';');
    }

    /**
     * 每週模式轉 crontab
     * 例如: days=[1,2,3,4,5], times=["08:00"] -> "0 8 * * 1-5"
     * 如果分鐘不同: days=[1,2,3,4,5], times=["08:00", "09:30"] -> "0 8 * * 1-5;30 9 * * 1-5"
     */
    static weeklyToCrontab(days: number[], times: string[]): string {
        if (days.length === 0 || times.length === 0) {
            return '0 8 * * 1-5';
        }

        const sortedDays = [...days].sort((a, b) => a - b);
        let dayExpr: string;

        // 檢查是否是連續的
        if (this.isConsecutive(sortedDays)) {
            dayExpr = `${sortedDays[0]}-${sortedDays[sortedDays.length - 1]}`;
        } else {
            dayExpr = sortedDays.join(',');
        }

        // 按分鐘分組
        const minuteGroups = new Map<number, number[]>();
        for (const time of times) {
            const [h, m] = time.split(':').map(Number);
            if (!minuteGroups.has(m)) {
                minuteGroups.set(m, []);
            }
            minuteGroups.get(m)!.push(h);
        }

        // 為每個分鐘組生成一條 crontab 表達式
        const expressions: string[] = [];
        for (const [minute, hours] of minuteGroups) {
            const hourList = hours.sort((a, b) => a - b).join(',');
            expressions.push(`${minute} ${hourList} * * ${dayExpr}`);
        }

        return expressions.join(';');
    }

    /**
     * 間隔模式轉 crontab
     * 例如: interval=4, start="07:00", end="23:00" -> "0 7,11,15,19,23 * * *"
     */
    static intervalToCrontab(
        intervalHours: number,
        startTime: string,
        endTime?: string
    ): string {
        const [startH, startM] = startTime.split(':').map(Number);
        const endH = endTime ? parseInt(endTime.split(':')[0], 10) : 23;

        const hours: number[] = [];
        for (let h = startH; h <= endH; h += intervalHours) {
            hours.push(h);
        }

        if (hours.length === 0) {
            hours.push(startH);
        }

        return `${startM} ${hours.join(',')} * * *`;
    }

    /**
     * 檢查數組是否連續
     */
    static isConsecutive(arr: number[]): boolean {
        if (arr.length <= 1) return true;
        for (let i = 1; i < arr.length; i++) {
            if (arr[i] !== arr[i - 1] + 1) {
                return false;
            }
        }
        return true;
    }

    /**
     * 解析 crontab 表達式（支援多條，用分號分隔）
     */
    static parse(crontab: string): CrontabParseResult {
        try {
            const expressions = crontab.split(';').filter(e => e.trim());

            if (expressions.length === 0) {
                return {
                    valid: false,
                    error: '無效的 crontab 格式',
                };
            }

            const allDescriptions: string[] = [];

            for (const expr of expressions) {
                const parts = expr.trim().split(/\s+/);
                if (parts.length !== 5) {
                    return {
                        valid: false,
                        error: '無效的 crontab 格式，需要 5 個欄位',
                    };
                }

                const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
                const desc = this.generateDescription(minute, hour, dayOfMonth, month, dayOfWeek);
                allDescriptions.push(desc);
            }

            // 獲取合併後的下次運行時間
            const nextRuns = this.getNextRuns(crontab, 5);

            // 合併描述（去重）
            const uniqueDescs = [...new Set(allDescriptions)];
            const description = uniqueDescs.length === 1
                ? uniqueDescs[0]
                : uniqueDescs.join(', ');

            return {
                valid: true,
                description,
                nextRuns,
            };
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            return {
                valid: false,
                error: err.message,
            };
        }
    }

    /**
     * 驗證 crontab 表達式
     */
    static validate(crontab: string): CrontabParseResult {
        return this.parse(crontab);
    }

    /**
     * 生成人類可讀描述
     */
    static generateDescription(
        minute: string,
        hour: string,
        dayOfMonth: string,
        month: string,
        dayOfWeek: string
    ): string {
        if (dayOfMonth !== '*' || month !== '*') {
            return '自訂排程';
        }

        if (minute.includes('/') || hour.includes('/') || dayOfWeek.includes('/')) {
            return '自訂排程';
        }

        const parts: string[] = [];

        // 時間描述
        if (minute === '0' && hour === '*') {
            parts.push('每小時整點');
        } else if (hour.includes(',')) {
            // 多個小時，相同分鐘：如 "0 7,12,17 * * *" -> "每天 07:00, 12:00, 17:00"
            const hours = hour.split(',');
            const min = minute.padStart(2, '0');
            const timeList = hours.map(h => `${h.padStart(2, '0')}:${min}`).join(', ');
            parts.push(`每天 ${timeList}`);
        } else if (hour !== '*' && minute !== '*') {
            // 單個時間點：如 "30 9 * * *" -> "每天 09:30"
            parts.push(`每天 ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`);
        }

        // 星期描述
        if (dayOfWeek !== '*') {
            const dayNames = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
            if (dayOfWeek === '1-5') {
                parts.push('工作日');
            } else if (dayOfWeek === '0,6' || dayOfWeek === '6,0') {
                parts.push('週末');
            } else {
                const days = this.expandField(dayOfWeek, 0, 6).map(d => dayNames[d]);
                parts.push(days.join(', '));
            }
        }

        return parts.join(' ') || '自訂排程';
    }

    /**
     * 展開 cron 欄位為數字陣列
     */
    static expandField(field: string, min: number, max: number): number[] {
        if (field === '*') {
            return Array.from({ length: max - min + 1 }, (_, i) => min + i);
        }

        const result: number[] = [];

        for (const part of field.split(',')) {
            if (part.includes('-')) {
                const [start, end] = part.split('-').map(Number);
                for (let i = start; i <= end; i++) {
                    result.push(i);
                }
            } else if (part.startsWith('*/')) {
                const step = parseInt(part.slice(2), 10);
                for (let i = min; i <= max; i += step) {
                    result.push(i);
                }
            } else {
                result.push(parseInt(part, 10));
            }
        }

        return [...new Set(result)].sort((a, b) => a - b);
    }

    /**
     * 計算接下來 n 次運行時間
     * 支援多條 crontab 表達式（用分號分隔）
     */
    static getNextRuns(crontab: string, count: number): Date[] {
        try {
            const expressions = crontab.split(';').filter(e => e.trim());
            const allDates: Date[] = [];
            const now = new Date();
            const searchLimit = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 天內

            for (const expr of expressions) {
                const parts = expr.trim().split(/\s+/);
                if (parts.length !== 5) continue;

                const [minuteField, hourField, dayOfMonthField, monthField, dayOfWeekField] = parts;

                const minutes = this.expandField(minuteField, 0, 59);
                const hours = this.expandField(hourField, 0, 23);
                const daysOfMonth = this.expandField(dayOfMonthField, 1, 31);
                const months = this.expandField(monthField, 1, 12);
                const daysOfWeek = this.expandField(dayOfWeekField, 0, 6);

                // 從現在開始逐分鐘搜索
                const current = new Date(now);
                current.setSeconds(0, 0);
                let foundCount = 0;

                while (current < searchLimit && foundCount < count) {
                    if (
                        minutes.includes(current.getMinutes()) &&
                        hours.includes(current.getHours()) &&
                        (dayOfMonthField === '*' || daysOfMonth.includes(current.getDate())) &&
                        (monthField === '*' || months.includes(current.getMonth() + 1)) &&
                        (dayOfWeekField === '*' || daysOfWeek.includes(current.getDay())) &&
                        current > now
                    ) {
                        allDates.push(new Date(current));
                        foundCount++;
                    }
                    current.setMinutes(current.getMinutes() + 1);
                }
            }

            // 排序並去重（按時間戳去重）
            const uniqueDates = Array.from(
                new Map(allDates.map(d => [d.getTime(), d])).values()
            );
            uniqueDates.sort((a, b) => a.getTime() - b.getTime());

            return uniqueDates.slice(0, count);
        } catch {
            return [];
        }
    }
}
