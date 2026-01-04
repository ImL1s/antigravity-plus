
import * as assert from 'assert';
import * as vscode from 'vscode';
import { DashboardPanel } from '../../ui/dashboard';
import { QuotaData } from '../../core/quota-monitor/controller';

suite('DashboardPanel Test Suite', () => {
    // Mock VS Code WebviewPanel
    const mockWebviewPanel = {
        title: 'Antigravity Plus',
        viewType: 'antigravityPlusDashboard',
        webview: {
            html: '',
            onDidReceiveMessage: () => ({ dispose: () => { } }),
            asWebviewUri: (uri: any) => uri,
            cspSource: 'self',
            options: {}
        },
        onDidDispose: () => ({ dispose: () => { } }),
        dispose: () => { },
        reveal: () => { }
    } as unknown as vscode.WebviewPanel;

    const mockExtensionUri = vscode.Uri.file('c:/test');

    // Mocks for dependencies
    const mockImpactTracker = {
        getStats: () => ({ clicksSaved: 0, sessions: 0, blocked: 0 }),
        getFormattedTimeSaved: () => '0m',
        getTimeUntilReset: () => '0m'
    } as any;

    const mockPerformanceMode = {
        getLevelDisplayName: () => 'Normal',
        getIntervalDisplay: () => '500ms',
        getSliderValue: () => 50
    } as any;

    const mockWakeupController = {
        getConfig: () => ({ enabled: false, mode: 'cloud' }),
        calculateNextTriggerTime: () => new Date(),
        getHistory: () => []
    } as any;

    test('updateQuota should update html with quota data', () => {
        // 使用 revive 來創建實例（因為 constructor 是 private）
        DashboardPanel.revive(
            mockWebviewPanel,
            mockExtensionUri,
            mockImpactTracker,
            mockPerformanceMode,
            mockWakeupController,
            false,
            '1.0.0-test'
        );

        const panel = DashboardPanel.currentPanel;
        assert.ok(panel, 'Panel should be initialized');

        // Initial HTML should not contain Quota cards
        // 注意: 由於我們在 constructor 呼叫 _update，初始 HTML 可能還沒有 Quota 數據

        // Update Quota
        const mockQuotaData: QuotaData = {
            models: [
                {
                    name: 'gemini-pro',
                    displayName: 'Gemini Pro',
                    used: 10,
                    total: 100,
                    percentage: 10,
                    remainingPercentage: 90,
                    resetTime: new Date()
                }
            ],
            lastUpdated: new Date(),
            accountLevel: 'free'
        };

        panel!.updateQuota(mockQuotaData);

        // Check if HTML contains the model name
        const html = mockWebviewPanel.webview.html;
        assert.ok(html.includes('Gemini Pro'), 'HTML should contain model name');
        assert.ok(html.includes('90%'), 'HTML should show remaining percentage');
        assert.ok(html.includes('quota-card'), 'HTML should render quota cards');
    });

    test('renders waiting state when no data', () => {
        DashboardPanel.revive(
            mockWebviewPanel,
            mockExtensionUri,
            mockImpactTracker,
            mockPerformanceMode,
            mockWakeupController,
            false,
            '1.0.0-test'
        );

        const panel = DashboardPanel.currentPanel;
        // Reset quota to undefined (simulate fresh start)
        (panel as any)._quotaData = undefined;
        (panel as any)._update();

        const html = mockWebviewPanel.webview.html;
        assert.ok(html.includes('Waiting for quota data'), 'Should confirm waiting state');
    });
});
