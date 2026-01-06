
import * as assert from 'assert';
import { AntigravityUsageProvider } from '../../providers/antigravity-usage';
import { Logger } from '../../utils/logger';

// Mock Logger - do not implement Logger interface to avoid private property issues
class MockLogger {
    debug(message: string): void { }
    info(message: string): void { }
    warn(message: string): void { }
    error(message: string): void { }
    showOutputChannel(): void { }
    dispose(): void { }
}

describe('AntigravityUsageProvider Tests', () => {
    let provider: AntigravityUsageProvider;
    let mockLogger: MockLogger;

    beforeEach(() => {
        mockLogger = new MockLogger();
        provider = new AntigravityUsageProvider(mockLogger as unknown as Logger);
    });

    describe('filterModels', () => {
        it('should return all models if visibleModels is empty', () => {
            const models = [
                { name: 'model-a', displayName: 'Model A' } as any,
                { name: 'model-b', displayName: 'Model B' } as any
            ];
            const filtered = (provider as any).filterModels(models, []);
            assert.strictEqual(filtered.length, 2);
        });

        it('should filter models by name', () => {
            const models = [
                { name: 'model-a', displayName: 'Model A' } as any,
                { name: 'model-b', displayName: 'Model B' } as any
            ];
            const filtered = (provider as any).filterModels(models, ['model-b']);
            assert.strictEqual(filtered.length, 1);
            assert.strictEqual(filtered[0].name, 'model-b');
        });

        it('should filter models by displayName', () => {
            const models = [
                { name: 'model-a', displayName: 'Model A' } as any,
                { name: 'model-b', displayName: 'Model B' } as any
            ];
            const filtered = (provider as any).filterModels(models, ['Model A']);
            assert.strictEqual(filtered.length, 1);
            assert.strictEqual(filtered[0].name, 'model-a');
        });

        it('should be case insensitive', () => {
            const models = [
                { name: 'model-a', displayName: 'Model A' } as any,
                { name: 'model-b', displayName: 'Model B' } as any
            ];
            const filtered = (provider as any).filterModels(models, ['model-A']);
            assert.strictEqual(filtered.length, 1);
            assert.strictEqual(filtered[0].name, 'model-a');
        });
    });

    describe('sortModels', () => {
        it('should sort based on clientModelSorts', () => {
            const models = [
                { name: 'c', displayName: 'C' } as any,
                { name: 'a', displayName: 'A' } as any,
                { name: 'b', displayName: 'B' } as any
            ];

            const modelSorts = [{
                groups: [{
                    modelLabels: ['B', 'A']
                }]
            }];

            (provider as any).sortModels(models, modelSorts);

            assert.strictEqual(models[0].displayName, 'B'); // First in sort list
            assert.strictEqual(models[1].displayName, 'A'); // Second in sort list
            assert.strictEqual(models[2].displayName, 'C'); // Not in list, last (alphabetical)
        });

        it('should fallback to alphabetical sort if no sort config', () => {
            const models = [
                { name: 'c', displayName: 'C' } as any,
                { name: 'a', displayName: 'A' } as any,
                { name: 'b', displayName: 'B' } as any
            ];

            (provider as any).sortModels(models, []);

            assert.strictEqual(models[0].displayName, 'A');
            assert.strictEqual(models[1].displayName, 'B');
            assert.strictEqual(models[2].displayName, 'C');
        });
    });
});
