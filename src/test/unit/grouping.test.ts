/**
 * Unit Tests: Grouping Manager
 * 
 * 覆蓋配額分組的建立、排序與置頂邏輯
 */

import * as assert from 'assert';

interface MockModelQuota {
    name: string;
    displayName: string;
    used: number;
    total: number;
    percentage: number;
}

interface MockQuotaGroup {
    id: string;
    name: string;
    displayName: string;
    models: MockModelQuota[];
    aggregatedQuota: {
        used: number;
        total: number;
        percentage: number;
    };
    isPinned: boolean;
    order: number;
}

class GroupingLogic {
    static getPoolForModel(modelName: string): string {
        // Note: 更長的 pattern 必須放在前面以確保正確匹配
        const poolMappings: [string, string][] = [
            ['gemini-3-pro-high', 'gemini-pro'],
            ['gemini-3-flash-thinking', 'gemini-flash'],
            ['gemini-3-pro', 'gemini-pro'],
            ['gemini-3-flash', 'gemini-flash'],
            ['claude-sonnet-4.5', 'claude-sonnet'],
            ['claude-opus-4.5', 'claude-opus'],
            ['gpt-4o-mini', 'gpt-4o-mini'],  // 必須在 gpt-4o 之前
            ['gpt-4o', 'gpt-4o'],
        ];

        for (const [pattern, pool] of poolMappings) {
            if (modelName.toLowerCase().includes(pattern)) {
                return pool;
            }
        }

        return 'ungrouped';
    }

    static calculateAggregatedQuota(models: MockModelQuota[]): { used: number; total: number; percentage: number } {
        const totalUsed = models.reduce((sum, m) => sum + m.used, 0);
        const totalLimit = models.reduce((sum, m) => sum + m.total, 0);
        const percentage = totalLimit > 0 ? Math.round((totalUsed / totalLimit) * 100) : 0;

        return { used: totalUsed, total: totalLimit, percentage };
    }

    static sortGroups(groups: MockQuotaGroup[]): MockQuotaGroup[] {
        return [...groups].sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            return a.order - b.order;
        });
    }
}

describe('Unit Tests - Grouping Logic', () => {
    describe('getPoolForModel', () => {
        it('should map Gemini models correctly', () => {
            assert.strictEqual(GroupingLogic.getPoolForModel('gemini-3-pro'), 'gemini-pro');
            assert.strictEqual(GroupingLogic.getPoolForModel('gemini-3-pro-high'), 'gemini-pro');
            assert.strictEqual(GroupingLogic.getPoolForModel('gemini-3-flash'), 'gemini-flash');
            assert.strictEqual(GroupingLogic.getPoolForModel('gemini-3-flash-thinking'), 'gemini-flash');
        });

        it('should map Claude models correctly', () => {
            assert.strictEqual(GroupingLogic.getPoolForModel('claude-sonnet-4.5'), 'claude-sonnet');
            assert.strictEqual(GroupingLogic.getPoolForModel('claude-opus-4.5'), 'claude-opus');
        });

        it('should map GPT models correctly', () => {
            assert.strictEqual(GroupingLogic.getPoolForModel('gpt-4o'), 'gpt-4o');
            assert.strictEqual(GroupingLogic.getPoolForModel('gpt-4o-mini'), 'gpt-4o-mini');
        });

        it('should return ungrouped for unknown models', () => {
            assert.strictEqual(GroupingLogic.getPoolForModel('unknown-model'), 'ungrouped');
            assert.strictEqual(GroupingLogic.getPoolForModel(''), 'ungrouped');
        });

        it('should be case insensitive', () => {
            assert.strictEqual(GroupingLogic.getPoolForModel('GEMINI-3-PRO'), 'gemini-pro');
            assert.strictEqual(GroupingLogic.getPoolForModel('Gemini-3-Flash'), 'gemini-flash');
        });
    });

    describe('calculateAggregatedQuota', () => {
        it('should calculate aggregated quota correctly', () => {
            const models: MockModelQuota[] = [
                { name: 'model1', displayName: 'Model 1', used: 10, total: 100, percentage: 10 },
                { name: 'model2', displayName: 'Model 2', used: 20, total: 100, percentage: 20 }
            ];

            const result = GroupingLogic.calculateAggregatedQuota(models);

            assert.strictEqual(result.used, 30);
            assert.strictEqual(result.total, 200);
            assert.strictEqual(result.percentage, 15);
        });

        it('should return zero for empty models', () => {
            const result = GroupingLogic.calculateAggregatedQuota([]);

            assert.strictEqual(result.used, 0);
            assert.strictEqual(result.total, 0);
            assert.strictEqual(result.percentage, 0);
        });

        it('should return zero percentage when total is zero', () => {
            const models: MockModelQuota[] = [
                { name: 'model1', displayName: 'Model 1', used: 0, total: 0, percentage: 0 }
            ];

            const result = GroupingLogic.calculateAggregatedQuota(models);
            assert.strictEqual(result.percentage, 0);
        });
    });

    describe('sortGroups', () => {
        it('should put pinned groups first', () => {
            const groups: MockQuotaGroup[] = [
                { id: 'a', name: 'a', displayName: 'A', models: [], aggregatedQuota: { used: 0, total: 0, percentage: 0 }, isPinned: false, order: 0 },
                { id: 'b', name: 'b', displayName: 'B', models: [], aggregatedQuota: { used: 0, total: 0, percentage: 0 }, isPinned: true, order: 1 },
                { id: 'c', name: 'c', displayName: 'C', models: [], aggregatedQuota: { used: 0, total: 0, percentage: 0 }, isPinned: false, order: 2 }
            ];

            const sorted = GroupingLogic.sortGroups(groups);

            assert.strictEqual(sorted[0].id, 'b', 'pinned group should be first');
            assert.strictEqual(sorted[1].id, 'a');
            assert.strictEqual(sorted[2].id, 'c');
        });

        it('should sort multiple pinned groups by order', () => {
            const groups: MockQuotaGroup[] = [
                { id: 'a', name: 'a', displayName: 'A', models: [], aggregatedQuota: { used: 0, total: 0, percentage: 0 }, isPinned: true, order: 2 },
                { id: 'b', name: 'b', displayName: 'B', models: [], aggregatedQuota: { used: 0, total: 0, percentage: 0 }, isPinned: true, order: 1 }
            ];

            const sorted = GroupingLogic.sortGroups(groups);

            assert.strictEqual(sorted[0].id, 'b', 'lower order should be first');
            assert.strictEqual(sorted[1].id, 'a');
        });

        it('should not modify original array', () => {
            const groups: MockQuotaGroup[] = [
                { id: 'a', name: 'a', displayName: 'A', models: [], aggregatedQuota: { used: 0, total: 0, percentage: 0 }, isPinned: false, order: 1 },
                { id: 'b', name: 'b', displayName: 'B', models: [], aggregatedQuota: { used: 0, total: 0, percentage: 0 }, isPinned: true, order: 0 }
            ];

            const sorted = GroupingLogic.sortGroups(groups);

            assert.strictEqual(groups[0].id, 'a', 'original array should not be modified');
            assert.strictEqual(sorted[0].id, 'b');
        });
    });
});
