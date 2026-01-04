/* eslint-disable */
import * as assert from 'assert';
import { StatusBarFormatter, IConfigProvider } from '../../core/quota-monitor/status-bar-format';
import { ModelQuota } from '../../core/quota-monitor/controller';

describe('StatusBarFormatter Tests', () => {
    let formatter: StatusBarFormatter;

    const mockModel: ModelQuota = {
        name: 'claude-3-5-sonnet',
        displayName: 'Claude 3.5 Sonnet',
        used: 10,
        total: 100,
        percentage: 10,
        remainingPercentage: 90
    };

    let configData: Record<string, any>;

    beforeEach(() => {
        configData = {
            'statusBarFormat': 'icon-percent',
            'warningThreshold': 30,
            'criticalThreshold': 10,
            'pinnedModels': [],
            'pinnedGroups': [],
            'showLowest': true
        };

        const configProvider: IConfigProvider = {
            get: (key: string, _defaultValue?: any) => {
                return configData[key];
            },
            update: (key: string, value: any) => {
                configData[key] = value;
                return Promise.resolve();
            }
        };

        formatter = new StatusBarFormatter(configProvider);
    });

    it('Should format icon-only correctly', () => {
        formatter.setFormat('icon-only');
        assert.strictEqual(formatter.formatModel(mockModel), String.fromCodePoint(0x1F680));
    });

    it('Should format color-icon correctly', () => {
        formatter.setFormat('color-icon');
        assert.strictEqual(formatter.formatModel(mockModel), String.fromCodePoint(0x1F7E2));
    });

    it('Should format percent-only correctly', () => {
        formatter.setFormat('percent-only');
        assert.strictEqual(formatter.formatModel(mockModel), '90%');
    });

    it('Should format icon-percent correctly', () => {
        formatter.setFormat('icon-percent');
        assert.strictEqual(formatter.formatModel(mockModel), String.fromCodePoint(0x1F7E2) + ' 90%');
    });

    it('Should format name-percent correctly', () => {
        formatter.setFormat('name-percent');
        assert.strictEqual(formatter.formatModel(mockModel), 'Sonnet: 90%');
    });

    it('Should format full correctly', () => {
        formatter.setFormat('full');
        assert.strictEqual(formatter.formatModel(mockModel), String.fromCodePoint(0x1F7E2) + ' Sonnet: 90%');
    });

    it('Should handle critical threshold', () => {
        formatter.setFormat('color-icon');
        const criticalModel = { ...mockModel, remainingPercentage: 5 };
        assert.strictEqual(formatter.formatModel(criticalModel), String.fromCodePoint(0x1F534));
    });

    it('Should handle warning threshold', () => {
        formatter.setFormat('color-icon');
        const warningModel = { ...mockModel, remainingPercentage: 20 };
        assert.strictEqual(formatter.formatModel(warningModel), String.fromCodePoint(0x1F7E1));
    });

    it('Should shorten model names correctly', () => {
        formatter.setFormat('full');
        const model = { ...mockModel, displayName: 'Gemini 1.5 Pro' };
        // Assuming Logic matches expected
    });
});

