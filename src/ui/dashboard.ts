/**
 * Dashboard Panel - 完整功能面板
 * 
 * 整合所有功能的 Webview UI
 */

import * as vscode from 'vscode';
import { ImpactTracker, ImpactStats } from '../core/auto-approve/impact-tracker';
import { PerformanceModeController } from '../core/auto-approve/performance-mode';
import { AutoWakeupControllerV2, ScheduleConfig } from '../core/auto-wakeup';
import { ContextOptimizerController, ContextSuggestion } from '../core/context-optimizer/controller';
import { QuotaMonitorController, QuotaData } from '../core/quota-monitor/controller';
import { ANTIGRAVITY_AUTH_UI_SCRIPT, AUTH_UI_CSS } from './webview-resources';
import { t, getCurrentStrings } from '../i18n';

export class DashboardPanel {
    public static currentPanel: DashboardPanel | undefined;
    private static readonly viewType = 'antigravityPlusDashboard';

    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private _suggestions: ContextSuggestion[] = [];

    private constructor(
        panel: vscode.WebviewPanel,
        private extensionUri: vscode.Uri,
        private impactTracker: ImpactTracker,
        private performanceMode: PerformanceModeController,
        private wakeupController: AutoWakeupControllerV2,
        private contextOptimizer: ContextOptimizerController,
        private quotaController: QuotaMonitorController,
        private isAutoApproveEnabled: boolean
    ) {
        this._panel = panel;
        this._update();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            message => this._handleMessage(message),
            null,
            this._disposables
        );

        // 訂閱配額更新，實現後端推送（解決 Webview 背景時 setInterval 暫停的問題）
        this.quotaController.onQuotaUpdate((data) => {
            this.updateQuotaData(data);
        });
    }

    public static createOrShow(
        extensionUri: vscode.Uri,
        impactTracker: ImpactTracker,
        performanceMode: PerformanceModeController,
        wakeupController: AutoWakeupControllerV2,
        contextOptimizer: ContextOptimizerController,
        quotaController: QuotaMonitorController,
        isAutoApproveEnabled: boolean
    ): DashboardPanel {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (DashboardPanel.currentPanel) {
            DashboardPanel.currentPanel._panel.reveal(column);
            DashboardPanel.currentPanel._update();
            return DashboardPanel.currentPanel;
        }

        const panel = vscode.window.createWebviewPanel(
            DashboardPanel.viewType,
            'Antigravity Plus',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [extensionUri]
            }
        );

        DashboardPanel.currentPanel = new DashboardPanel(
            panel,
            extensionUri,
            impactTracker,
            performanceMode,
            wakeupController,
            contextOptimizer,
            quotaController,
            isAutoApproveEnabled
        );

        return DashboardPanel.currentPanel;
    }

    public updateAutoApproveState(enabled: boolean): void {
        this.isAutoApproveEnabled = enabled;
        this._update();
    }

    /**
     * 從後端推送配額更新到 Webview
     * 用於解決 Webview 背景時 setInterval 暫停的問題
     */
    public updateQuotaData(data: QuotaData): void {
        if (this._panel.visible) {
            this._panel.webview.postMessage({ command: 'updateQuota', data });
        }
    }

    private _update(): void {
        const stats = this.impactTracker.getStats();
        const wakeupConfig = this.wakeupController.getConfig();
        const nextTrigger = this.wakeupController.getNextRunTimeFormatted() || 'Not scheduled';
        const history = this.wakeupController.getHistory().slice(0, 5);

        this._panel.webview.html = this._getHtml(stats, wakeupConfig, nextTrigger, history);
    }

    private _handleMessage(message: any): void {
        switch (message.command) {
            case 'toggleAutoApprove':
                vscode.commands.executeCommand('antigravity-plus.toggleAutoApprove');
                break;
            case 'setPerformanceLevel':
                this.performanceMode.setFromSlider(message.value);
                this._update();
                break;
            case 'toggleWakeup':
                this.wakeupController.updateConfig({ enabled: message.enabled });
                this._update();
                break;
            case 'testWakeup':
                this.wakeupController.testNow();
                break;
            case 'updateWakeupConfig':
                this.wakeupController.updateConfig(message.config);
                this._update();
                break;
            case 'refresh':
                this._update();
                break;
            case 'analyzeContext':
                this.contextOptimizer.analyzeContext().then(suggestions => {
                    this._suggestions = suggestions;
                    this._update();
                });
                break;
            case 'applyOptimization':
                this.contextOptimizer.applyOptimization(this._suggestions);
                this.impactTracker.logActivity('optimization', '執行了 Context 優化建議');
                this._update();
                break;
            case 'refreshQuota':
                this.quotaController.refresh().then(() => {
                    const data = this.quotaController.getQuotaData();
                    this._panel.webview.postMessage({ command: 'updateQuota', data });
                });
                break;

            // Auth UI Handlers
            case 'autoTrigger.authorize':
            case 'autoTrigger.addAccount':
            case 'autoTrigger.reauthorizeAccount':
                this.wakeupController.startAuthorization().then(success => {
                    if (success) {
                        vscode.window.showInformationMessage(t('notifications.auth.success') || 'Authorization successful');
                        this.quotaController.refresh(); // Refresh quota after auth
                    }
                });
                break;
            case 'autoTrigger.removeAccount':
                this.wakeupController.revokeAuthorization().then(() => {
                    vscode.window.showInformationMessage(t('notifications.auth.revoked') || 'Logged out');
                    this.quotaController.refresh();
                });
                break;
            case 'autoTrigger.switchAccount':
                vscode.window.showInformationMessage('Multi-account switching is not yet supported in this version. Please re-authorize.');
                this.wakeupController.startAuthorization();
                break;
        }
    }

    private _getHtml(
        stats: ImpactStats,
        wakeupConfig: { enabled: boolean; mode: string; workStartTime: string; models: string[] },
        nextTrigger: string,
        history: any[]
    ): string {
        const timeSaved = this.impactTracker.getFormattedTimeSaved();
        const resetIn = this.impactTracker.getTimeUntilReset();
        const perfLevel = this.performanceMode.getLevelDisplayName();
        const perfInterval = this.performanceMode.getIntervalDisplay();
        const sliderValue = this.performanceMode.getSliderValue();

        const cspSource = this._panel.webview.cspSource;
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src ${cspSource} 'unsafe-inline';">
    <title>Antigravity Plus</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            color: #e0e0e0;
            padding: 20px;
            min-height: 100vh;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .spinner {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 2px solid #667eea;
            border-top-color: transparent;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            vertical-align: middle;
            margin-right: 8px;
        }
        
        .header {
            text-align: center;
            margin-bottom: 24px;
        }
        
        .header h1 {
            font-size: 24px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 4px;
        }
        
        .header .version {
            color: #888;
            font-size: 12px;
        }
        
        .card {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 16px;
        }
        
        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        }
        
        .card-title {
            font-size: 14px;
            font-weight: 600;
            color: #667eea;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .toggle {
            width: 48px;
            height: 24px;
            background: #333;
            border-radius: 12px;
            position: relative;
            cursor: pointer;
            transition: background 0.3s;
        }
        
        .toggle.on {
            background: #667eea;
        }
        
        .toggle::after {
            content: '';
            position: absolute;
            width: 20px;
            height: 20px;
            background: white;
            border-radius: 50%;
            top: 2px;
            left: 2px;
            transition: left 0.3s;
        }
        
        .toggle.on::after {
            left: 26px;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
        }
        
        .stat {
            text-align: center;
            padding: 12px;
            background: rgba(102, 126, 234, 0.1);
            border-radius: 8px;
        }
        
        .stat-value {
            font-size: 28px;
            font-weight: 700;
            color: #4ade80;
        }
        
        .stat-value.warning {
            color: #fbbf24;
        }
        
        .stat-value.danger {
            color: #ef4444;
        }
        
        .stat-label {
            font-size: 11px;
            color: #888;
            text-transform: uppercase;
            margin-top: 4px;
        }
        
        .slider-container {
            margin: 12px 0;
        }
        
        .slider-labels {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            color: #888;
            margin-bottom: 8px;
        }
        
        .slider {
            width: 100%;
            height: 6px;
            -webkit-appearance: none;
            background: linear-gradient(90deg, #667eea 0%, #333 100%);
            border-radius: 3px;
            outline: none;
        }
        
        .slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 18px;
            height: 18px;
            background: #667eea;
            border-radius: 50%;
            cursor: pointer;
        }
        
        .current-value {
            text-align: center;
            margin-top: 8px;
            font-size: 12px;
            color: #667eea;
        }
        
        .safety-rules {
            background: rgba(0, 0, 0, 0.3);
            border-radius: 8px;
            padding: 12px;
            font-family: 'Fira Code', monospace;
            font-size: 11px;
            color: #ef4444;
            max-height: 120px;
            overflow-y: auto;
        }
        
        .safety-rules code {
            display: block;
            margin: 2px 0;
        }
        
        .wakeup-info {
            display: flex;
            justify-content: space-between;
            margin: 12px 0;
            font-size: 13px;
        }
        
        .wakeup-info span {
            color: #888;
        }
        
        .wakeup-info strong {
            color: #4ade80;
        }
        
        .btn-group {
            display: flex;
            gap: 8px;
            margin-top: 12px;
        }
        
        .btn {
            flex: 1;
            padding: 10px;
            border: none;
            border-radius: 6px;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.3s;
        }
        
        .btn-primary {
            background: #667eea;
            color: white;
        }
        
        .btn-primary:hover {
            background: #5a6fd6;
        }
        
        .btn-secondary {
            background: rgba(255, 255, 255, 0.1);
            color: #e0e0e0;
        }
        
        .btn-secondary:hover {
            background: rgba(255, 255, 255, 0.15);
        }
        
        .history-list {
            max-height: 100px;
            overflow-y: auto;
        }
        
        .history-item {
            display: flex;
            justify-content: space-between;
            padding: 6px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            font-size: 11px;
        }
        
        .history-item .success {
            color: #4ade80;
        }
        
        .history-item .failure {
            color: #ef4444;
        }
        
        .timeline {
            margin-top: 12px;
            border-left: 2px solid rgba(102, 126, 234, 0.3);
            padding-left: 16px;
        }
        
        .timeline-item {
            position: relative;
            margin-bottom: 12px;
        }
        
        .timeline-item::before {
            content: '';
            position: absolute;
            left: -21px;
            top: 4px;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #667eea;
        }
        
        .timeline-time {
            font-size: 10px;
            color: #888;
        }
        
        .timeline-content {
            font-size: 12px;
            margin-top: 2px;
        }

        .suggestion-item {
            display: flex;
            justify-content: space-between;
            padding: 8px;
            background: rgba(255, 255, 255, 0.03);
            border-radius: 4px;
            margin-bottom: 4px;
            font-size: 12px;
        }

        .suggestion-action {
            font-weight: bold;
            color: #4ade80;
        }

        .suggestion-action.unpin {
            color: #ef4444;
        }
        
        .reset-badge {
            font-size: 11px;
            color: #888;
            float: right;
        }

        /* Inject Auth UI CSS */
        ${AUTH_UI_CSS}
    </style>
</head>
<body>
    <div class="header">
        <h1>Antigravity Plus</h1>
        <span class="version">v1.0.0</span>
    </div>

    <!-- Auth Bar -->
    <div id="quota-auth-card" class="quota-auth-card" style="margin-bottom: 20px;">
        <div id="quota-auth-row" class="quota-auth-row"></div>
    </div>

    <!-- Auto Accept -->
    <div class="card">
        <div class="card-header">
            <span class="card-title">⚡ ${t('dashboard.autoApprove.title')}</span>
            <div class="toggle ${this.isAutoApproveEnabled ? 'on' : ''}" onclick="toggleAutoApprove()"></div>
        </div>
    </div>

    <!-- Impact Dashboard -->
    <div class="card">
        <div class="card-header">
            <span class="card-title">📊 ${t('dashboard.impact.title')}</span>
            <span class="reset-badge">${t('dashboard.impact.resets')} ${resetIn}</span>
        </div>
        <div class="stats-grid">
            <div class="stat">
                <div class="stat-value">${stats.clicksSaved.toLocaleString()}</div>
                <div class="stat-label">${t('dashboard.impact.clicksSaved')}</div>
            </div>
            <div class="stat">
                <div class="stat-value">${timeSaved}</div>
                <div class="stat-label">${t('dashboard.impact.timeSaved')}</div>
            </div>
            <div class="stat">
                <div class="stat-value">${stats.sessions}</div>
                <div class="stat-label">${t('dashboard.impact.sessions')}</div>
            </div>
            <div class="stat">
                <div class="stat-value ${stats.blocked > 0 ? 'warning' : ''}">${stats.blocked}</div>
                <div class="stat-label">${t('dashboard.impact.blocked')}</div>
            </div>
        </div>
    </div>

    <!-- Quota Monitor -->
    <div class="card">
        <div class="card-header">
            <span class="card-title">📊 ${t('dashboard.quota.title')}</span>
            <button class="btn btn-secondary" onclick="refreshQuota()">🔄 ${t('dashboard.quota.refresh')}</button>
        </div>
        <div id="quota-content" style="text-align: center; padding: 20px;">
            <div class="spinner"></div>
            <span>${t('statusBar.quota.loading')}</span>
        </div>
    </div>

    <!-- Performance Mode -->
    <div class="card">
        <div class="card-header">
            <span class="card-title">⚡ ${t('dashboard.performance.title')}</span>
        </div>
        <div class="slider-container">
            <div class="slider-labels">
                <span>${t('dashboard.performance.instant')}</span>
                <span>${t('dashboard.performance.batterySaving')}</span>
            </div>
            <input type="range" class="slider" min="0" max="100" value="${sliderValue}" 
                   oninput="updatePerformance(this.value)">
            <div class="current-value">${perfLevel} (${perfInterval})</div>
        </div>
    </div>

    <!-- Context Optimizer -->
    <div class="card">
        <div class="card-header">
            <span class="card-title">🔍 ${t('dashboard.context.title')}</span>
        </div>
        <div id="suggestions-container">
            ${this._suggestions.length > 0 ?
                this._suggestions.slice(0, 5).map(s => `
                    <div class="suggestion-item">
                        <span>${s.file.fsPath.split(/[\\/]/).pop()}</span>
                        <span class="suggestion-action ${s.action}">${s.action.toUpperCase()}</span>
                    </div>
                `).join('') : `<p style="font-size:12px;color:#888;">${t('dashboard.context.notAnalyzed')}</p>`
            }
        </div>
        <div class="btn-group">
            <button class="btn btn-primary" onclick="analyzeContext()">${t('dashboard.context.analyze')}</button>
            ${this._suggestions.length > 0 ? `<button class="btn btn-secondary" onclick="applyOptimization()">${t('dashboard.context.apply')}</button>` : ''}
        </div>
    </div>

    <!-- Activity Timeline -->
    <div class="card">
        <div class="card-header">
            <span class="card-title">🕒 ${t('dashboard.timeline.title')}</span>
        </div>
        <div class="timeline">
            ${(stats.activityLog || []).slice(0, 5).map(log => `
                <div class="timeline-item">
                    <div class="timeline-time">${new Date(log.timestamp).toLocaleTimeString()}</div>
                    <div class="timeline-content">${log.description}</div>
                </div>
            `).join('')}
        </div>
    </div>

    <!-- Auto Wake-up -->
    <div class="card">
        <div class="card-header">
            <span class="card-title">🔔 ${t('dashboard.wakeup.title')}</span>
            <div class="toggle ${wakeupConfig.enabled ? 'on' : ''}" onclick="toggleWakeup()"></div>
        </div>
        <div class="wakeup-info">
            <span>${t('dashboard.wakeup.nextTrigger')}:</span>
            <strong>${nextTrigger.toLocaleString()}</strong>
        </div>
        <div class="wakeup-info">
            <span>${t('dashboard.wakeup.mode')}:</span>
            <strong>${wakeupConfig.mode}</strong>
        </div>
        <div class="btn-group">
            <button class="btn btn-secondary" onclick="testWakeup()">${t('dashboard.wakeup.testNow')}</button>
            <button class="btn btn-secondary" onclick="showHistory()">${t('dashboard.wakeup.history')} (${history.length})</button>
        </div>
    </div>

    <!-- Safety Rules -->
    <div class="card">
        <div class="card-header">
            <span class="card-title">🛡️ ${t('dashboard.safety.title')}</span>
        </div>
        <div class="safety-rules">
            <code>rm -rf /</code>
            <code>rm -rf ~</code>
            <code>rm -rf *</code>
            <code>format c:</code>
            <code>del /f /s /q</code>
            <code>rmdir /s /q</code>
            <code>:(){:|:&};:</code>
            <code>dd if=</code>
            <code>mkfs.</code>
            <code>> /dev/sda</code>
        </div>
    </div>

    <script>
        window.__i18n = ${JSON.stringify(getCurrentStrings())};
        ${ANTIGRAVITY_AUTH_UI_SCRIPT}

        const vscode = acquireVsCodeApi();
        let authUi;

        // Initialize Auth UI
        try {
            authUi = new PlusAuthUI(vscode);
            authUi.renderAuthRow(document.getElementById('quota-auth-row'));
        } catch (e) {
            console.error('Failed to init Auth UI', e);
        }
        
        
        function toggleAutoApprove() {
            vscode.postMessage({ command: 'toggleAutoApprove' });
        }
        
        function updatePerformance(value) {
            vscode.postMessage({ command: 'setPerformanceLevel', value: parseInt(value) });
        }
        
        function toggleWakeup() {
            const currentState = ${wakeupConfig.enabled};
            vscode.postMessage({ command: 'toggleWakeup', enabled: !currentState });
        }
        
        function testWakeup() {
            vscode.postMessage({ command: 'testWakeup' });
        }
        
        function showHistory() {
            // TODO: 展開歷史列表
        }

        function analyzeContext() {
            vscode.postMessage({ command: 'analyzeContext' });
        }

        function refreshQuota() {
            const content = document.getElementById('quota-content');
            content.innerHTML = '<div class="spinner"></div><span>Updating...</span>';
            vscode.postMessage({ command: 'refreshQuota' });
        }

        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'updateQuota') {
                const content = document.getElementById('quota-content');
                if (message.data) {
                    const models = message.data.models || [];
                    const html = models.map(m => \`
                        <div style="margin-bottom: 8px; text-align: left;">
                            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
                                <span>\${m.displayName}</span>
                                <span>\${m.percentage}%</span>
                            </div>
                            <div style="background: rgba(255,255,255,0.1); height: 6px; border-radius: 3px; overflow: hidden;">
                                <div style="background: \${m.isExhausted ? '#ef4444' : '#4ade80'}; width: \${m.percentage}%; height: 100%;"></div>
                            </div>
                            <div style="font-size: 10px; color: #888; margin-top: 2px;">Resets in: \${m.timeUntilResetFormatted}</div>
                        </div>
                    \`).join('');
                    content.innerHTML = html || 'No quota data available';
                } else {
                    content.innerHTML = '<span style="color: #ef4444">Failed to load quota</span>';
                }

                // Update Auth UI
                if (authUi && message.data) {
                    const userInfo = message.data.userInfo;
                    // Construct authorization object compatible with Cockpit Auth UI
                    const authorization = {
                        isAuthorized: !!userInfo,
                        activeAccount: userInfo ? userInfo.email : null,
                        accounts: userInfo ? [{ email: userInfo.email }] : []
                    };
                    authUi.updateState(authorization, false); // Disable sync toggle for now
                    authUi.renderAuthRow(document.getElementById('quota-auth-row'));
                }
            }
        });

        // Initial load
        refreshQuota();
        
        // Auto refresh every 60 seconds (sync with Status Bar)
        setInterval(() => {
            refreshQuota();
        }, 60000);
    </script>
</body>
</html>`;
    }

    public dispose(): void {
        DashboardPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}
