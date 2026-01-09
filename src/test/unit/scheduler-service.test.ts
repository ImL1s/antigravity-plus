
import * as assert from 'assert';
import { SchedulerService } from '../../core/auto-wakeup/scheduler-service';
import { ScheduleConfig } from '../../core/auto-wakeup/types';
import { Logger } from '../../utils/logger';

describe('Unit Tests - SchedulerService', () => {
    let service: SchedulerService;
    let mockLogger: Logger;

    beforeEach(() => {
        mockLogger = {
            info: () => { },
            warn: () => { },
            error: () => { },
            debug: () => { }
        } as unknown as Logger;
        service = new SchedulerService(mockLogger);
    });

    afterEach(() => {
        service.dispose();
    });

    describe('Config Management', () => {
        it('should update config', () => {
            const newConfig: ScheduleConfig = {
                enabled: true,
                repeatMode: 'daily',
                dailyTimes: ['10:00'],
                selectedModels: []
            };
            service.setConfig(newConfig);
            const current = service.getConfig();
            assert.strictEqual(current.enabled, true);
            assert.strictEqual(current.repeatMode, 'daily');
            assert.strictEqual(current.dailyTimes![0], '10:00');
        });
    });

    describe('calculateNextTriggerTime', () => {
        it('should return null if disabled', () => {
            service.setConfig({ enabled: false, repeatMode: 'daily', selectedModels: [] });
            assert.strictEqual(service.calculateNextTriggerTime(), null);
        });

        it('should calculate daily trigger', () => {
            // Mock "now" as 09:00
            const now = new Date('2023-01-01T09:00:00');
            service.setConfig({
                enabled: true,
                repeatMode: 'daily',
                dailyTimes: ['10:00'],
                selectedModels: []
            });

            const next = service.calculateNextTriggerTime(now);
            assert.ok(next);
            assert.strictEqual(next?.getHours(), 10);
            assert.strictEqual(next?.getDate(), 1); // today
        });

        it('should calculate daily tomorrow if passed', () => {
            const now = new Date('2023-01-01T11:00:00');
            service.setConfig({
                enabled: true,
                repeatMode: 'daily',
                dailyTimes: ['10:00'],
                selectedModels: []
            });

            const next = service.calculateNextTriggerTime(now);
            assert.ok(next);
            assert.strictEqual(next?.getHours(), 10);
            assert.strictEqual(next?.getDate(), 2); // tomorrow
        });

        it('should calculate weekly trigger', () => {
            // 2023-01-01 is Sunday (0)
            const now = new Date('2023-01-01T09:00:00');

            service.setConfig({
                enabled: true,
                repeatMode: 'weekly',
                weeklyDays: [1], // Monday
                weeklyTimes: ['09:00'],
                selectedModels: []
            });

            const next = service.calculateNextTriggerTime(now);
            assert.ok(next);
            assert.strictEqual(next?.getDay(), 1); // Monday
        });

        it('should calculate interval trigger', () => {
            const now = new Date('2023-01-01T08:00:00');
            // Start 07:00, every 4h -> 07, 11, 15...
            service.setConfig({
                enabled: true,
                repeatMode: 'interval',
                intervalHours: 4,
                intervalStartTime: '07:00',
                selectedModels: []
            });

            const next = service.calculateNextTriggerTime(now);
            assert.ok(next);
            assert.strictEqual(next?.getHours(), 11);
        });
    });

    describe('Integration with CronParser', () => {
        it('should use cron parser logic', () => {
            service.setConfig({ enabled: true, repeatMode: 'interval', intervalHours: 4, intervalStartTime: '07:00', selectedModels: [] });
            const crontab = service.configToCrontab();
            assert.ok(crontab.startsWith('0 7,11'));
        });
    });
});
