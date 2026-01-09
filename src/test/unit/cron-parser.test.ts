
import * as assert from 'assert';
import { CronParser } from '../../core/auto-wakeup/cron-parser';

describe('Unit Tests - CronParser', () => {

    describe('dailyToCrontab', () => {
        it('should use default if empty', () => {
            const result = CronParser.dailyToCrontab([]);
            assert.strictEqual(result, '0 8 * * *');
        });

        it('should format single time', () => {
            const result = CronParser.dailyToCrontab(['07:00']);
            assert.strictEqual(result, '0 7 * * *');
        });

        it('should combine same minutes', () => {
            const result = CronParser.dailyToCrontab(['07:00', '12:00', '17:00']);
            assert.strictEqual(result, '0 7,12,17 * * *');
        });

        it('should split different minutes with semicolon', () => {
            const result = CronParser.dailyToCrontab(['07:00', '09:30']);
            // order might vary if map doesn't preserve insertion, but usually does
            // expects: "0 7 * * *;30 9 * * *"
            assert.ok(result.includes('0 7 * * *'));
            assert.ok(result.includes('30 9 * * *'));
            assert.ok(result.includes(';'));
        });
    });

    describe('weeklyToCrontab', () => {
        it('should use default if empty', () => {
            assert.strictEqual(CronParser.weeklyToCrontab([], []), '0 8 * * 1-5');
        });

        it('should format continuous days', () => {
            // Mon-Fri: 1-5
            const result = CronParser.weeklyToCrontab([1, 2, 3, 4, 5], ['08:00']);
            assert.strictEqual(result, '0 8 * * 1-5');
        });

        it('should format non-continuous days', () => {
            // Mon, Wed, Fri: 1, 3, 5
            const result = CronParser.weeklyToCrontab([1, 3, 5], ['08:00']);
            assert.strictEqual(result, '0 8 * * 1,3,5');
        });

        it('should handle multiple times', () => {
            const result = CronParser.weeklyToCrontab([1, 5], ['08:00', '18:00']);
            // 0 8,18 * * 1,5
            assert.strictEqual(result, '0 8,18 * * 1,5');
        });
    });

    describe('intervalToCrontab', () => {
        it('should generate interval hours', () => {
            // every 4h from 7:00 to 23:00 -> 7, 11, 15, 19, 23
            const result = CronParser.intervalToCrontab(4, '07:00', '23:00');
            assert.strictEqual(result, '0 7,11,15,19,23 * * *');
        });

        it('should handle start only (implies until 23)', () => {
            // start 20:00, interval 2h -> 20, 22
            const result = CronParser.intervalToCrontab(2, '20:00');
            assert.strictEqual(result, '0 20,22 * * *');
        });

        it('should handle minutes', () => {
            const result = CronParser.intervalToCrontab(4, '07:30');
            assert.ok(result.startsWith('30 '));
        });
    });

    describe('Parsing & Validation', () => {
        it('should validate valid cron', () => {
            const res = CronParser.validate('0 8 * * *');
            assert.strictEqual(res.valid, true);
        });

        it('should invalidate empty', () => {
            const res = CronParser.validate('');
            assert.strictEqual(res.valid, false);
        });

        it('should invalidate wrong fields', () => {
            const res = CronParser.validate('0 8 * *'); // 4 fields
            assert.strictEqual(res.valid, false);
        });

        it('should handle multiple cron', () => {
            const res = CronParser.validate('0 8 * * *; 30 9 * * *');
            assert.strictEqual(res.valid, true);
        });
    });

    describe('Description Generation', () => {
        it('should describe simple daily', () => {
            const res = CronParser.parse('0 8 * * *');
            assert.ok(res.description?.includes('08:00'));
        });

        it('should describe workdays', () => {
            const res = CronParser.parse('0 8 * * 1-5');
            assert.ok(res.description?.includes('工作日'));
        });
    });

    describe('Next Runs', () => {
        it('should calculate next runs', () => {
            // Every min
            const next = CronParser.getNextRuns('* * * * *', 2);
            assert.strictEqual(next.length, 2);
            assert.ok(next[1].getTime() > next[0].getTime());
        });
    });

});
