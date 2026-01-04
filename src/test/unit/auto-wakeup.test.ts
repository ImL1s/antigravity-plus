/**
 * Unit Tests: Auto Wake-up Scheduler & History
 * 
 * 覆蓋排程邏輯與歷史記錄管理
 */

import * as assert from 'assert';

// ========== Scheduler Tests ==========

interface SchedulerTestResult {
    scheduled: boolean;
    delay: number;
    triggered: boolean;
}

class TestableScheduler {
    private timeoutId: NodeJS.Timeout | null = null;
    private onTriggerCallback: (() => void) | null = null;
    private scheduledTime: Date | null = null;
    private logs: string[] = [];

    schedule(time: Date): SchedulerTestResult {
        this.cancel();

        const now = Date.now();
        const delay = time.getTime() - now;

        if (delay <= 0) {
            this.logs.push('Schedule time has passed');
            return { scheduled: false, delay: 0, triggered: false };
        }

        this.scheduledTime = time;
        this.logs.push(`Scheduled with delay ${delay}ms`);
        return { scheduled: true, delay, triggered: false };
    }

    cancel(): void {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        this.scheduledTime = null;
    }

    onTrigger(callback: () => void): void {
        this.onTriggerCallback = callback;
    }

    getScheduledTime(): Date | null {
        return this.scheduledTime;
    }

    isScheduled(): boolean {
        return this.scheduledTime !== null;
    }

    getTimeUntilTrigger(): number | null {
        if (!this.scheduledTime) return null;
        return Math.max(0, this.scheduledTime.getTime() - Date.now());
    }

    getLogs(): string[] {
        return this.logs;
    }
}

// ========== History Tests ==========

interface WakeupHistoryEntry {
    timestamp: Date;
    model: string;
    success: boolean;
    tokensUsed: number;
    error?: string;
}

class TestableHistory {
    private entries: WakeupHistoryEntry[] = [];
    private readonly maxEntries = 100;

    add(entry: WakeupHistoryEntry): void {
        this.entries.unshift(entry);
        if (this.entries.length > this.maxEntries) {
            this.entries = this.entries.slice(0, this.maxEntries);
        }
    }

    getAll(): WakeupHistoryEntry[] {
        return [...this.entries];
    }

    getRecent(count: number): WakeupHistoryEntry[] {
        return this.entries.slice(0, count);
    }

    getSuccessCount(): number {
        return this.entries.filter(e => e.success).length;
    }

    getFailureCount(): number {
        return this.entries.filter(e => !e.success).length;
    }

    getTotalTokensUsed(): number {
        return this.entries.reduce((sum, e) => sum + e.tokensUsed, 0);
    }

    getLastEntry(): WakeupHistoryEntry | null {
        return this.entries[0] || null;
    }

    clear(): void {
        this.entries = [];
    }
}

// ========== Test Suites ==========

describe('Unit Tests - Auto Wake-up Scheduler', () => {
    let scheduler: TestableScheduler;

    beforeEach(() => {
        scheduler = new TestableScheduler();
    });

    describe('排程功能', () => {
        it('應該能排程未來的時間', () => {
            const futureTime = new Date(Date.now() + 60000); // 1 分鐘後
            const result = scheduler.schedule(futureTime);

            assert.strictEqual(result.scheduled, true);
            assert.ok(result.delay > 0);
        });

        it('過去的時間應該無法排程', () => {
            const pastTime = new Date(Date.now() - 1000); // 1 秒前
            const result = scheduler.schedule(pastTime);

            assert.strictEqual(result.scheduled, false);
        });

        it('排程後應該能取得排程時間', () => {
            const futureTime = new Date(Date.now() + 60000);
            scheduler.schedule(futureTime);

            assert.ok(scheduler.getScheduledTime());
            assert.strictEqual(scheduler.isScheduled(), true);
        });

        it('取消後排程時間應為 null', () => {
            const futureTime = new Date(Date.now() + 60000);
            scheduler.schedule(futureTime);
            scheduler.cancel();

            assert.strictEqual(scheduler.getScheduledTime(), null);
            assert.strictEqual(scheduler.isScheduled(), false);
        });
    });

    describe('時間計算', () => {
        it('getTimeUntilTrigger 應該返回正確的剩餘時間', () => {
            const delay = 60000;
            const futureTime = new Date(Date.now() + delay);
            scheduler.schedule(futureTime);

            const remaining = scheduler.getTimeUntilTrigger();
            assert.ok(remaining !== null);
            assert.ok(remaining <= delay);
            assert.ok(remaining > delay - 1000); // 允許 1 秒誤差
        });

        it('未排程時 getTimeUntilTrigger 應返回 null', () => {
            assert.strictEqual(scheduler.getTimeUntilTrigger(), null);
        });
    });
});

describe('Unit Tests - Auto Wake-up History', () => {
    let history: TestableHistory;

    beforeEach(() => {
        history = new TestableHistory();
    });

    describe('新增記錄', () => {
        it('應該能新增記錄', () => {
            history.add({
                timestamp: new Date(),
                model: 'gemini-pro',
                success: true,
                tokensUsed: 100
            });

            assert.strictEqual(history.getAll().length, 1);
        });

        it('新記錄應該在最前面', () => {
            history.add({ timestamp: new Date(), model: 'first', success: true, tokensUsed: 100 });
            history.add({ timestamp: new Date(), model: 'second', success: true, tokensUsed: 200 });

            assert.strictEqual(history.getLastEntry()?.model, 'second');
        });

        it('應該限制最大數量為 100', () => {
            for (let i = 0; i < 150; i++) {
                history.add({ timestamp: new Date(), model: `model-${i}`, success: true, tokensUsed: 10 });
            }

            assert.strictEqual(history.getAll().length, 100);
        });
    });

    describe('查詢功能', () => {
        beforeEach(() => {
            history.add({ timestamp: new Date(), model: 'model-1', success: true, tokensUsed: 100 });
            history.add({ timestamp: new Date(), model: 'model-2', success: false, tokensUsed: 50, error: 'timeout' });
            history.add({ timestamp: new Date(), model: 'model-3', success: true, tokensUsed: 200 });
        });

        it('getRecent 應該返回正確數量', () => {
            assert.strictEqual(history.getRecent(2).length, 2);
            assert.strictEqual(history.getRecent(10).length, 3);
        });

        it('getSuccessCount 應該正確計算', () => {
            assert.strictEqual(history.getSuccessCount(), 2);
        });

        it('getFailureCount 應該正確計算', () => {
            assert.strictEqual(history.getFailureCount(), 1);
        });

        it('getTotalTokensUsed 應該正確累計', () => {
            assert.strictEqual(history.getTotalTokensUsed(), 350);
        });
    });

    describe('清除功能', () => {
        it('clear 應該清除所有記錄', () => {
            history.add({ timestamp: new Date(), model: 'test', success: true, tokensUsed: 100 });
            history.clear();

            assert.strictEqual(history.getAll().length, 0);
            assert.strictEqual(history.getLastEntry(), null);
        });
    });
});
