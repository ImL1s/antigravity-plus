import './mock-vscode';
import * as assert from 'assert';
// import * as sinon from 'sinon';
import { GroupingManager } from '../../core/quota-monitor/grouping';
import { ModelQuota } from '../../core/quota-monitor/controller';

suite('GroupingManager Tests', () => {
    let manager: GroupingManager;
    let contextStub: any;

    const mockModels: ModelQuota[] = [
        {
            name: 'gemini-2.0-pro-exp',
            displayName: 'Gemini Pro',
            used: 10,
            total: 100,
            percentage: 10,
            remainingPercentage: 90,
            remainingFraction: 0.9,
            resetTime: new Date('2025-01-01T12:00:00Z')
        },
        {
            name: 'gemini-2.0-flash-exp',
            displayName: 'Gemini Flash',
            used: 10,
            total: 100,
            percentage: 10,
            remainingPercentage: 90,
            remainingFraction: 0.9, // Same fraction/reset as Pro -> Should group together
            resetTime: new Date('2025-01-01T12:00:00Z')
        },
        {
            name: 'claude-3-5-sonnet',
            displayName: 'Claude Sonnet',
            used: 50,
            total: 100,
            percentage: 50,
            remainingPercentage: 50,
            remainingFraction: 0.5,
            resetTime: new Date('2025-01-01T14:00:00Z')
        }
    ];

    setup(() => {
        // Mock context
        contextStub = {
            globalState: {
                get: (_key: string) => undefined,
                update: (_key: string, _value: any) => Promise.resolve()
            }
        };

        manager = new GroupingManager(contextStub);
    });

    test('Should dynamic group models with same quota pool (Cockpit logic)', () => {
        const groups = manager.createGroups(mockModels);

        // Expect 2 groups: Gemini (2 models) and Claude (1 model)
        assert.strictEqual(groups.length, 2, 'Should create 2 groups');

        const geminiGroup = groups.find(g => g.models.length === 2);
        assert.ok(geminiGroup, 'Should find a group with 2 models');

        const claudeGroup = groups.find(g => g.models.length === 1);
        assert.ok(claudeGroup, 'Should find a group with 1 model');
    });

    test('Should fallback to static mapping if dynamic data missing', () => {
        const staticModels: ModelQuota[] = [
            {
                name: 'gemini-3-pro',
                displayName: 'Gemini Pro',
                used: 0,
                total: 100,
                percentage: 0
                // No remainingFraction/resetTime -> Fallback
            },
            {
                name: 'gpt-4o',
                displayName: 'GPT-4o',
                used: 0,
                total: 100,
                percentage: 0
            }
        ];

        const groups = manager.createGroups(staticModels);
        assert.strictEqual(groups.length, 2);

        const geminiGroup = groups.find(g => g.id === 'gemini-pro');
        assert.ok(geminiGroup, 'Should identify gemini-pro group via static fallback');
    });
});
