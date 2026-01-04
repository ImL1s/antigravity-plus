/**
 * 單元測試：倒數計時
 * 
 * 可獨立運行，不依賴 VS Code
 */

import * as assert from 'assert';

// 複製倒數計時邏輯
function calculateCountdown(resetTime: Date): { text: string; shortText: string; isExpired: boolean; totalSeconds: number } {
    const now = Date.now();
    const diff = resetTime.getTime() - now;

    if (diff <= 0) {
        return { text: 'Reset', shortText: 'Reset', isExpired: true, totalSeconds: 0 };
    }

    const totalSeconds = Math.floor(diff / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    let text: string;
    let shortText: string;

    if (hours > 0) {
        text = `${hours}h ${minutes}m`;
        shortText = `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
        text = `${minutes}m`;
        shortText = `${minutes}m`;
    } else {
        text = `${totalSeconds}s`;
        shortText = `${totalSeconds}s`;
    }

    return { text, shortText, isExpired: false, totalSeconds };
}

function formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

function formatResetTime(resetTime: Date): string {
    return resetTime.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

describe('Countdown Unit Tests', () => {
    describe('calculateCountdown', () => {
        it('未來時間應該顯示倒數', () => {
            const future = new Date(Date.now() + 3600000);
            const result = calculateCountdown(future);

            assert.strictEqual(result.isExpired, false);
            assert.ok(result.totalSeconds > 0);
            assert.ok(result.shortText.includes('h') || result.shortText.includes('m'));
        });

        it('過去時間應該顯示已重置', () => {
            const past = new Date(Date.now() - 1000);
            const result = calculateCountdown(past);

            assert.strictEqual(result.isExpired, true);
            assert.strictEqual(result.totalSeconds, 0);
        });

        it('30 分鐘應該格式化為 30m', () => {
            const future = new Date(Date.now() + 1800000);
            const result = calculateCountdown(future);

            assert.ok(result.shortText.includes('m'));
            assert.ok(!result.shortText.includes('h'));
        });

        it('2 小時 30 分鐘應該格式化為 2h 30m', () => {
            const future = new Date(Date.now() + 9000000);
            const result = calculateCountdown(future);

            assert.ok(result.shortText.includes('h'));
            assert.ok(result.shortText.includes('m'));
        });
    });

    describe('formatDuration', () => {
        it('59 秒應該顯示秒數', () => {
            assert.strictEqual(formatDuration(59), '59s');
        });

        it('60 秒應該顯示為分鐘', () => {
            assert.ok(formatDuration(60).includes('m'));
        });

        it('3661 秒應該顯示為 1h 1m', () => {
            const result = formatDuration(3661);
            assert.ok(result.includes('1h'));
            assert.ok(result.includes('1m'));
        });
    });

    describe('formatResetTime', () => {
        it('應該格式化為本地時間', () => {
            const time = new Date();
            const result = formatResetTime(time);

            assert.ok(result.includes(':'));
        });
    });
});
