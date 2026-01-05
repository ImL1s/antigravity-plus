/**
 * Dashboard Panel - 完整功能面板
 * 
 * 整合所有功能的 Webview UI
 */

import * as vscode from 'vscode';
import { ImpactTracker, ImpactStats } from '../core/auto-approve/impact-tracker';
import { PerformanceModeController } from '../core/auto-approve/performance-mode';
import { AutoWakeupController, WakeupConfig } from '../core/auto-wakeup/controller';
import { ContextOptimizerController, ContextSuggestion } from '../core/context-optimizer/controller';

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
        private wakeupController: AutoWakeupController,
        private contextOptimizer: ContextOptimizerController,
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
    }

    public static createOrShow(
        extensionUri: vscode.Uri,
        impactTracker: ImpactTracker,
        performanceMode: PerformanceModeController,
        wakeupController: AutoWakeupController,
        contextOptimizer: ContextOptimizerController,
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
                retainContextWhenHidden: true
            }
        );

        DashboardPanel.currentPanel = new DashboardPanel(
            panel,
            extensionUri,
            impactTracker,
            performanceMode,
            wakeupController,
            contextOptimizer,
            isAutoApproveEnabled
        );

        return DashboardPanel.currentPanel;
    }

    public updateAutoApproveState(enabled: boolean): void {
        this.isAutoApproveEnabled = enabled;
        this._update();
    }

    private _update(): void {
        const stats = this.impactTracker.getStats();
        const wakeupConfig = this.wakeupController.getConfig();
        const nextTrigger = this.wakeupController.calculateNextTriggerTime();
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
        }
    }

    private _getHtml(
        stats: ImpactStats,
        wakeupConfig: WakeupConfig,
        nextTrigger: Date,
        history: any[]
    ): string {
        const timeSaved = this.impactTracker.getFormattedTimeSaved();
        const resetIn = this.impactTracker.getTimeUntilReset();
        const perfLevel = this.performanceMode.getLevelDisplayName();
        const perfInterval = this.performanceMode.getIntervalDisplay();
        const sliderValue = this.performanceMode.getSliderValue();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
    </style>
</head>
<body>
    <div class="header">
        <h1>Antigravity Plus</h1>
        <span class="version">v1.0.0</span>
    </div>

    <!-- Auto Accept -->
    <div class="card">
        <div class="card-header">
            <span class="card-title">⚡ Auto Accept</span>
            <div class="toggle ${this.isAutoApproveEnabled ? 'on' : ''}" onclick="toggleAutoApprove()"></div>
        </div>
    </div>

    <!-- Impact Dashboard -->
    <div class="card">
        <div class="card-header">
            <span class="card-title">📊 Impact Dashboard</span>
            <span class="reset-badge">Resets ${resetIn}</span>
        </div>
        <div class="stats-grid">
            <div class="stat">
                <div class="stat-value">${stats.clicksSaved.toLocaleString()}</div>
                <div class="stat-label">Clicks Saved</div>
            </div>
            <div class="stat">
                <div class="stat-value">${timeSaved}</div>
                <div class="stat-label">Time Saved</div>
            </div>
            <div class="stat">
                <div class="stat-value">${stats.sessions}</div>
                <div class="stat-label">Sessions</div>
            </div>
            <div class="stat">
                <div class="stat-value ${stats.blocked > 0 ? 'warning' : ''}">${stats.blocked}</div>
                <div class="stat-label">Blocked</div>
            </div>
        </div>
    </div>

    <!-- Performance Mode -->
    <div class="card">
        <div class="card-header">
            <span class="card-title">⚡ Performance Mode</span>
        </div>
        <div class="slider-container">
            <div class="slider-labels">
                <span>Instant</span>
                <span>Battery Saving</span>
            </div>
            <input type="range" class="slider" min="0" max="100" value="${sliderValue}" 
                   oninput="updatePerformance(this.value)">
            <div class="current-value">${perfLevel} (${perfInterval})</div>
        </div>
    </div>

    <!-- Context Optimizer -->
    <div class="card">
        <div class="card-header">
            <span class="card-title">🔍 Context Optimizer</span>
        </div>
        <div id="suggestions-container">
            ${this._suggestions.length > 0 ?
                this._suggestions.slice(0, 5).map(s => `
                    <div class="suggestion-item">
                        <span>${s.file.fsPath.split(/[\\/]/).pop()}</span>
                        <span class="suggestion-action ${s.action}">${s.action.toUpperCase()}</span>
                    </div>
                `).join('') : '<p style="font-size:12px;color:#888;">尚未分析</p>'
            }
        </div>
        <div class="btn-group">
            <button class="btn btn-primary" onclick="analyzeContext()">Analyze Now</button>
            ${this._suggestions.length > 0 ? '<button class="btn btn-secondary" onclick="applyOptimization()">Apply</button>' : ''}
        </div>
    </div>

    <!-- Activity Timeline -->
    <div class="card">
        <div class="card-header">
            <span class="card-title">🕒 Activity Timeline</span>
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
            <span class="card-title">🔔 Auto Wake-up</span>
            <div class="toggle ${wakeupConfig.enabled ? 'on' : ''}" onclick="toggleWakeup()"></div>
        </div>
        <div class="wakeup-info">
            <span>Next Trigger:</span>
            <strong>${nextTrigger.toLocaleString()}</strong>
        </div>
        <div class="wakeup-info">
            <span>Mode:</span>
            <strong>${wakeupConfig.mode}</strong>
        </div>
        <div class="btn-group">
            <button class="btn btn-secondary" onclick="testWakeup()">Test Now</button>
            <button class="btn btn-secondary" onclick="showHistory()">History (${history.length})</button>
        </div>
    </div>

    <!-- Safety Rules -->
    <div class="card">
        <div class="card-header">
            <span class="card-title">🛡️ Safety Rules</span>
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
        const vscode = acquireVsCodeApi();
        
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

        function applyOptimization() {
            vscode.postMessage({ command: 'applyOptimization' });
        }
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
