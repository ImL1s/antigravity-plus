
import * as assert from 'assert';
import * as vscode from 'vscode';
import { QuotaMonitorController, QuotaData } from '../../core/quota-monitor/controller';
import { Logger } from '../../utils/logger';
import { ConfigManager } from '../../utils/config';
import { StatusBarManager } from '../../ui/status-bar';

// 1. Mock Classes
class MockLogger {
    info(_msg: string) { console.log(`[MockLogger] INFO: ${_msg}`); }
    warn(_msg: string) { console.log(`[MockLogger] WARN: ${_msg}`); }
    error(_msg: string) { console.log(`[MockLogger] ERROR: ${_msg}`); }
    debug(_msg: string) { }
}

class MockStatusBarManager {
    public lastQuotaData: QuotaData | undefined;
    updateQuota(data: QuotaData) {
        this.lastQuotaData = data;
    }
    updateSession(_session: any) { }
    dispose() { }
}

class MockUsageProvider {
    constructor(private mockData: QuotaData | undefined) { }
    async fetchQuota(): Promise<QuotaData | undefined> {
        return this.mockData;
    }
}

// 2. Testable Subclass
class TestableQuotaMonitorController extends QuotaMonitorController {
    // Expose / overwrite protected members
    public async setMockProvider(data: QuotaData) {
        (this as any).usageProvider = new MockUsageProvider(data);
    }

    public getStatusManager(): MockStatusBarManager {
        return (this as any).statusBarManager as MockStatusBarManager;
    }
}

describe('Quota Monitor Integration Tests', () => {
    let controller: TestableQuotaMonitorController;
    let mockStatusBar: MockStatusBarManager;
    let mockLogger: Logger;
    let configManager: ConfigManager;

    beforeEach(() => {
        mockLogger = new MockLogger() as unknown as Logger;
        mockStatusBar = new MockStatusBarManager();
        configManager = new ConfigManager();

        const context = {
            subscriptions: [],
            extensionUri: vscode.Uri.file('.'),
            globalState: {
                get: (_key: string) => undefined,
                update: (_key: string, _value: any) => Promise.resolve(),
            }
        } as unknown as vscode.ExtensionContext;

        controller = new TestableQuotaMonitorController(
            context,
            mockLogger,
            configManager,
            mockStatusBar as unknown as StatusBarManager
        );
    });

    afterEach(() => {
        controller.dispose();
    });

    it('Should initialize and not crash', () => {
        assert.ok(controller);
    });

    it('Refresh should update status bar with fetched data', async () => {
        const mockData: QuotaData = {
            models: [
                { name: 'gemini-pro', displayName: 'Pro', used: 10, total: 100, percentage: 10, remainingFraction: 0.9 },
                { name: 'gemini-flash', displayName: 'Flash', used: 50, total: 100, percentage: 50, remainingFraction: 0.5 }
            ],
            accountLevel: 'Tier 1',
            lastUpdated: new Date()
        };

        await controller.setMockProvider(mockData);
        await controller.refresh();

        const updatedData = mockStatusBar.lastQuotaData;
        assert.ok(updatedData, 'Status bar should accept data');
        assert.strictEqual(updatedData?.models.length, 2, 'Should have 2 models');
        assert.strictEqual(updatedData?.models[0].name, 'gemini-pro');
    });

    it('Should handle exhausted quota correctly', async () => {
        const mockData: QuotaData = {
            models: [
                { name: 'gemini-pro', displayName: 'Pro', used: 100, total: 100, percentage: 100, remainingFraction: 0, isExhausted: true }
            ],
            accountLevel: 'Tier 1',
            lastUpdated: new Date()
        };

        await controller.setMockProvider(mockData);
        await controller.refresh();

        const updatedData = mockStatusBar.lastQuotaData;
        assert.ok(updatedData?.models[0].isExhausted, 'Model should be marked exhausted');
    });
});
