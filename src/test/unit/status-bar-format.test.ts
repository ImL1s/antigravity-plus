/* eslint-disable */
import './mock-vscode';
import * as assert from 'assert';
// import * as sinon from 'sinon'; // Not strictly needed if we just pass mocks
import { StatusBarFormatter, IConfigProvider } from '../../core/quota-monitor/status-bar-format';
import { ModelQuota } from '../../core/quota-monitor/controller';

suite('StatusBarFormatter Tests', () => {
    let formatter: StatusBarFormatter;
    // let configStub: Record<string, any>;

    const mockModel: ModelQuota = {
        name: 'claude-3-5-sonnet',
        displayName: 'Claude 3.5 Sonnet',
        used: 10,
        total: 100,
        percentage: 10,
        remainingPercentage: 90
    };

    let configData: Record<string, any>;

    setup(() => {
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

    test('Should format icon-only correctly', () => {
        formatter.setFormat('icon-only');
        assert.strictEqual(formatter.formatModel(mockModel), '\u{1F680}'); // Rocket
    });

    test('Should format color-icon correctly', () => {
        formatter.setFormat('color-icon');
        // 90% > 30% -> Green
        assert.strictEqual(formatter.formatModel(mockModel), '\u{1F7E2}'); // Green Circle
    });

    test('Should format percent-only correctly', () => {
        formatter.setFormat('percent-only');
        assert.strictEqual(formatter.formatModel(mockModel), '90%');
    });

    test('Should format icon-percent correctly', () => {
        formatter.setFormat('icon-percent');
        assert.strictEqual(formatter.formatModel(mockModel), '\u{1F7E2} 90%');
    });

    test('Should format name-percent correctly', () => {
        formatter.setFormat('name-percent');
        assert.strictEqual(formatter.formatModel(mockModel), 'Sonnet: 90%');
    });

    test('Should format full correctly', () => {
        formatter.setFormat('full');
        assert.strictEqual(formatter.formatModel(mockModel), '\u{1F7E2} Sonnet: 90%');
    });

    test('Should handle critical threshold', () => {
        formatter.setFormat('color-icon');
        const criticalModel = { ...mockModel, remainingPercentage: 5 };
        assert.strictEqual(formatter.formatModel(criticalModel), '\u{1F534}'); // Red Circle
    });

    test('Should handle warning threshold', () => {
        formatter.setFormat('color-icon');
        const warningModel = { ...mockModel, remainingPercentage: 20 };
        assert.strictEqual(formatter.formatModel(warningModel), '\u{1F7E1}'); // Yellow Circle
    });

    // We can't easily test updateConfig because it relies on vscode.workspace.getConfiguration internally to save
    // UNLESS we refactor updateConfig too. But tests above cover the main LOGIC.
    // Let's refactor setFormat/saveConfig in the class if we want to be pure.
    // For now, these tests cover the output format logic which is the most critical part.

    test('Should shorten model names correctly', () => {
        formatter.setFormat('full');

        const models = [
            { name: 'claude-3-opus', expected: 'Opus' },
            { name: 'gemini-2.5-pro', expected: 'Gemini Pro' },
            { name: 'gpt-4o', expected: 'GPT-4o' },
            { name: 'unknown-very-long-model-name', expected: 'unknown-…' }
        ];

        for (const m of models) {
            const model = { ...mockModel, name: m.name };
            const result = formatter.formatModel(model);
            assert.ok(result.includes(m.expected), `Expected ${result} to include ${m.expected} (Got: ${result})`);
        }
    });
});
