/**
 * Advanced Settings Panel - 進階設定面板
 * 
 * 參考 MunKhin/auto-accept-agent 的 settings-panel.js
 * 提供 Impact Dashboard, Performance Slider, Banned Commands Editor
 */

import * as vscode from 'vscode';
import { ROITracker } from '../core/analytics/roi-tracker';
import { ConfigManager } from '../utils/config';
import { t } from '../i18n';

export class SettingsPanel {
    public static currentPanel: SettingsPanel | undefined;
    public static readonly viewType = 'antigravity-plus.settings';

    private readonly panel: vscode.WebviewPanel;
    private readonly extensionUri: vscode.Uri;
    private disposables: vscode.Disposable[] = [];

    private constructor(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        private context: vscode.ExtensionContext,
        private roiTracker: ROITracker,
        private configManager: ConfigManager
    ) {
        this.panel = panel;
        this.extensionUri = extensionUri;

        this.update();

        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

        this.panel.webview.onDidReceiveMessage(
            message => this.handleMessage(message),
            null,
            this.disposables
        );
    }

    public static createOrShow(
        extensionUri: vscode.Uri,
        context: vscode.ExtensionContext,
        roiTracker: ROITracker,
        configManager: ConfigManager
    ): void {
        const column = vscode.ViewColumn.Beside;

        if (SettingsPanel.currentPanel) {
            SettingsPanel.currentPanel.panel.reveal(column);
            SettingsPanel.currentPanel.update();
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            SettingsPanel.viewType,
            'Antigravity+ Settings',
            column,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [extensionUri]
            }
        );

        SettingsPanel.currentPanel = new SettingsPanel(
            panel,
            extensionUri,
            context,
            roiTracker,
            configManager
        );
    }

    private async handleMessage(message: { command: string;[key: string]: unknown }): Promise<void> {
        switch (message.command) {
            case 'updateInterval':
                await this.configManager.set('autoApprove.interval', message.value as number);
                vscode.window.showInformationMessage(`輪詢間隔已設為 ${message.value}ms`);
                break;

            case 'updateBannedCommands':
                const commands = (message.value as string).split('\n').filter(c => c.trim());
                await vscode.workspace.getConfiguration('antigravity-plus').update(
                    'autoApprove.denyList',
                    commands,
                    vscode.ConfigurationTarget.Global
                );
                vscode.window.showInformationMessage(`已更新 ${commands.length} 條禁止指令`);
                break;

            case 'resetBannedCommands':
                await vscode.workspace.getConfiguration('antigravity-plus').update(
                    'autoApprove.denyList',
                    undefined,
                    vscode.ConfigurationTarget.Global
                );
                this.update();
                vscode.window.showInformationMessage('禁止指令已重置為預設值');
                break;

            case 'openExtensionSettings':
                vscode.commands.executeCommand('workbench.action.openSettings', 'antigravity-plus');
                break;

            case 'refresh':
                this.update();
                break;
        }
    }

    private async update(): Promise<void> {
        const roiStats = await this.roiTracker.getROIStats();
        const interval = this.configManager.get<number>('autoApprove.interval') ?? 200;
        const denyList = vscode.workspace.getConfiguration('antigravity-plus').get<string[]>('autoApprove.denyList') ?? [];

        this.panel.webview.html = this.getHtmlContent(roiStats, interval, denyList);
    }

    private getHtmlContent(
        roiStats: { clicksThisWeek: number; blockedThisWeek: number; sessionsThisWeek: number; timeSavedFormatted: string },
        interval: number,
        denyList: string[]
    ): string {
        const nonce = this.getNonce();

        return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Antigravity+ Settings</title>
    <style>
        :root {
            --bg: #0a0a0c;
            --card-bg: #121216;
            --border: rgba(147, 51, 234, 0.2);
            --border-hover: rgba(147, 51, 234, 0.4);
            --accent: #9333ea;
            --accent-soft: rgba(147, 51, 234, 0.1);
            --green: #22c55e;
            --green-soft: rgba(34, 197, 94, 0.1);
            --fg: #ffffff;
            --fg-dim: rgba(255, 255, 255, 0.6);
            --font: 'Segoe UI', system-ui, -apple-system, sans-serif;
        }

        body {
            font-family: var(--font);
            background: var(--bg);
            color: var(--fg);
            margin: 0;
            padding: 32px 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
            min-height: 100vh;
        }

        .container {
            max-width: 640px;
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 24px;
        }

        /* Header */
        .header {
            text-align: center;
            margin-bottom: 8px;
        }
        .header h1 {
            font-size: 24px;
            font-weight: 800;
            margin: 0 0 8px 0;
            letter-spacing: -0.5px;
        }
        .header p {
            color: var(--fg-dim);
            font-size: 14px;
            margin: 0;
        }

        /* Card */
        .card {
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 24px;
            transition: border-color 0.2s;
        }
        .card:hover {
            border-color: var(--border-hover);
        }
        .card-title {
            font-size: 16px;
            font-weight: 700;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        /* Stats Grid */
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
        }
        .stat-item {
            background: rgba(0, 0, 0, 0.3);
            border-radius: 8px;
            padding: 16px;
            text-align: center;
        }
        .stat-value {
            font-size: 28px;
            font-weight: 800;
            color: var(--accent);
            margin-bottom: 4px;
        }
        .stat-value.green { color: var(--green); }
        .stat-label {
            font-size: 12px;
            color: var(--fg-dim);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        /* Slider */
        .slider-container {
            margin-top: 8px;
        }
        .slider-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 12px;
        }
        .slider-label { font-size: 13px; color: var(--fg-dim); }
        .slider-value { 
            font-size: 13px; 
            font-weight: 700; 
            color: var(--accent);
            background: var(--accent-soft);
            padding: 2px 8px;
            border-radius: 4px;
        }
        input[type="range"] {
            width: 100%;
            height: 6px;
            -webkit-appearance: none;
            background: linear-gradient(to right, var(--accent), var(--green));
            border-radius: 3px;
            outline: none;
        }
        input[type="range"]::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 18px;
            height: 18px;
            background: var(--fg);
            border-radius: 50%;
            cursor: pointer;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        }

        /* Textarea */
        textarea {
            width: 100%;
            min-height: 140px;
            background: rgba(0,0,0,0.3);
            border: 1px solid var(--border);
            border-radius: 8px;
            color: var(--fg);
            font-family: 'JetBrains Mono', 'Fira Code', monospace;
            font-size: 12px;
            padding: 12px;
            resize: vertical;
            outline: none;
            box-sizing: border-box;
        }
        textarea:focus { border-color: var(--accent); }

        /* Buttons */
        .btn-row {
            display: flex;
            gap: 12px;
            margin-top: 16px;
        }
        .btn {
            flex: 1;
            padding: 12px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            border: 1px solid var(--border);
            background: transparent;
            color: var(--fg);
        }
        .btn:hover {
            background: var(--accent-soft);
            border-color: var(--accent);
        }
        .btn-primary {
            background: var(--accent);
            border-color: var(--accent);
        }
        .btn-primary:hover {
            filter: brightness(1.2);
        }

        /* Footer */
        .footer {
            text-align: center;
            color: var(--fg-dim);
            font-size: 11px;
            margin-top: 16px;
        }
        .footer a {
            color: var(--accent);
            text-decoration: none;
        }
        .footer a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <h1>⚙️ Antigravity+ Settings</h1>
            <p>配置自動核准與效能設定</p>
        </div>

        <!-- Impact Dashboard -->
        <div class="card">
            <div class="card-title">📊 本週影響統計</div>
            <div class="stats-grid">
                <div class="stat-item">
                    <div class="stat-value">${roiStats.clicksThisWeek}</div>
                    <div class="stat-label">自動接受</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value green">${roiStats.timeSavedFormatted}</div>
                    <div class="stat-label">節省時間</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${roiStats.blockedThisWeek}</div>
                    <div class="stat-label">已阻擋</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${roiStats.sessionsThisWeek}</div>
                    <div class="stat-label">工作階段</div>
                </div>
            </div>
        </div>

        <!-- Performance Slider -->
        <div class="card">
            <div class="card-title">⚡ 效能設定</div>
            <div class="slider-container">
                <div class="slider-header">
                    <span class="slider-label">輪詢間隔</span>
                    <span class="slider-value" id="intervalValue">${interval}ms</span>
                </div>
                <input type="range" id="intervalSlider" min="200" max="3000" step="100" value="${interval}">
                <div class="slider-header" style="margin-top: 8px;">
                    <span style="font-size: 11px; color: var(--fg-dim);">快速 (200ms)</span>
                    <span style="font-size: 11px; color: var(--fg-dim);">慢速 (3000ms)</span>
                </div>
            </div>
        </div>

        <!-- Banned Commands -->
        <div class="card">
            <div class="card-title">🚫 禁止指令清單</div>
            <p style="font-size: 12px; color: var(--fg-dim); margin-bottom: 12px;">
                每行一個指令。這些指令永遠不會被自動接受。
            </p>
            <textarea id="bannedCommands" placeholder="rm -rf /&#10;format c:&#10;...">${denyList.join('\n')}</textarea>
            <div class="btn-row">
                <button class="btn" onclick="resetBanned()">重置為預設</button>
                <button class="btn btn-primary" onclick="saveBanned()">儲存變更</button>
            </div>
        </div>

        <!-- Footer -->
        <div class="footer">
            <a href="#" onclick="openSettings()">開啟完整設定</a> · 
            <a href="#" onclick="refresh()">重新整理</a>
        </div>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();

        // Interval slider
        const slider = document.getElementById('intervalSlider');
        const valueDisplay = document.getElementById('intervalValue');
        let debounceTimer;

        slider.addEventListener('input', (e) => {
            valueDisplay.textContent = e.target.value + 'ms';
        });

        slider.addEventListener('change', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                vscode.postMessage({ command: 'updateInterval', value: parseInt(e.target.value) });
            }, 300);
        });

        // Banned commands
        function saveBanned() {
            const textarea = document.getElementById('bannedCommands');
            vscode.postMessage({ command: 'updateBannedCommands', value: textarea.value });
        }

        function resetBanned() {
            vscode.postMessage({ command: 'resetBannedCommands' });
        }

        function openSettings() {
            vscode.postMessage({ command: 'openExtensionSettings' });
        }

        function refresh() {
            vscode.postMessage({ command: 'refresh' });
        }
    </script>
</body>
</html>`;
    }

    private getNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

    public dispose(): void {
        SettingsPanel.currentPanel = undefined;
        this.panel.dispose();
        while (this.disposables.length) {
            const x = this.disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
}
