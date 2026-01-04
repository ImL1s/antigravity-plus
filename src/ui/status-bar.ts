/**
 * 狀態列管理器 (Enhanced)
 * 
 * 支援多群組顯示，樣式參考 Antigravity Cockpit:
 * 🟢 Group 1: 73% | 🟢 Gemini 3 Flash: 87% | 🔴 Group 3: 0%   ✓ Auto Accept: ON   🌐 Background: OFF   ⚙ Settings
 */

import * as vscode from 'vscode';
import { QuotaData, UsageSession, ModelQuota } from '../core/quota-monitor/controller';
import { QuotaGroup } from '../core/quota-monitor/grouping';
import { calculateCountdown } from '../core/quota-monitor/countdown';
import { t } from '../i18n';

export type StatusBarFormat =
    | 'icon'              // 🟢
    | 'percentage'        // 95%
    | 'iconPercentage'    // 🟢 95%
    | 'namePercentage'    // Sonnet: 95%
    | 'iconNamePercentage'// 🟢 Sonnet: 95%
    | 'progressBar';      // ████░░░░

export class StatusBarManager implements vscode.Disposable {
    // Core Items
    private quotaItem: vscode.StatusBarItem;  // 単一配額顯示項目（對標 Cockpit）
    private autoApproveItem: vscode.StatusBarItem;
    private backgroundItem: vscode.StatusBarItem;
    private settingsItem: vscode.StatusBarItem;

    // Dynamic Group Items (備用）
    private groupItems: vscode.StatusBarItem[] = [];
    private readonly MAX_GROUPS = 5;

    // State
    private autoApproveEnabled = false;
    private backgroundEnabled = false;
    private currentQuotaData: QuotaData | undefined;
    private currentGroups: QuotaGroup[] = [];
    private countdownTimer: NodeJS.Timeout | undefined;

    constructor(private context: vscode.ExtensionContext) {
        // === 建立固定項目 (右至左優先級: 低數字 = 更靠右) ===

        // 0. Quota Display (最左邊配額顯示 - 對標 Cockpit)
        this.quotaItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            201
        );
        this.quotaItem.command = 'antigravity-plus.openDashboard';
        this.quotaItem.text = `$(sync~spin) 配額載入中...`;
        this.quotaItem.tooltip = t('statusBar.quota.loading') || 'Loading quota...';
        this.quotaItem.show();

        // 1. Auto Accept (最右邊)
        this.autoApproveItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            200
        );
        this.autoApproveItem.command = 'antigravity-plus.toggleAutoApprove';
        this.updateAutoApproveState(false);
        this.autoApproveItem.show();

        // 2. Background Status
        this.backgroundItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            199
        );
        this.backgroundItem.command = 'antigravity-plus.toggleAutoWakeup';
        this.updateBackgroundState(false);
        // ✅ 對標 Auto Accept Agent: 預設隱藏，只在 Auto Approve ON 時顯示
        // this.backgroundItem.show();  // 移除預設 show

        // 3. Settings (最左邊的固定項目)
        this.settingsItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            198
        );
        this.settingsItem.text = `$(gear) Antigravity`;
        this.settingsItem.tooltip = t('statusBar.settings.tooltip') || 'Open Antigravity Plus Settings';
        this.settingsItem.command = 'antigravity-plus.openDashboard';
        this.settingsItem.show();

        // 註冊清理
        context.subscriptions.push(
            this.quotaItem,
            this.autoApproveItem,
            this.backgroundItem,
            this.settingsItem
        );

        // 啟動倒數計時更新
        this.startCountdownUpdates();
    }

    // ========== Auto Approve ==========

    /**
     * 更新自動核准狀態
     */
    public updateAutoApproveState(enabled: boolean): void {
        this.autoApproveEnabled = enabled;

        if (enabled) {
            this.autoApproveItem.text = `$(check) Auto Accept: ON`;
            this.autoApproveItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
            // ✅ 對標 Auto Accept Agent: 開啟時顯示 Background 項目
            this.backgroundItem.show();
        } else {
            this.autoApproveItem.text = `$(circle-slash) Auto Accept: OFF`;
            this.autoApproveItem.backgroundColor = undefined;
            // ✅ 對標 Auto Accept Agent: 關閉時隱藏 Background 項目
            this.backgroundItem.hide();
        }

        this.autoApproveItem.tooltip = t('statusBar.autoApprove.tooltip');
    }

    // ========== Background (Auto Wake-up) ==========

    /**
     * 更新背景執行狀態
     */
    public updateBackgroundState(enabled: boolean): void {
        this.backgroundEnabled = enabled;

        if (enabled) {
            this.backgroundItem.text = `$(globe) Background: ON`;
            this.backgroundItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
        } else {
            this.backgroundItem.text = `$(globe) Background: OFF`;
            this.backgroundItem.backgroundColor = undefined;
        }

        this.backgroundItem.tooltip = t('statusBar.background.tooltip') || 'Auto Wake-up Background Status';
    }

    // ========== Quota Groups ==========

    /**
     * 設定載入狀態 (對標 Cockpit setLoading)
     */
    public setLoading(text?: string): void {
        this.quotaItem.text = `$(sync~spin) ${text || t('statusBar.quota.loading') || 'Loading...'}`;
        this.quotaItem.backgroundColor = undefined;
    }

    /**
     * 設定就緒狀態 (對標 Cockpit setReady)
     */
    public setReady(): void {
        this.quotaItem.text = `$(rocket) ${t('statusBar.quota.ready') || 'Ready'}`;
        this.quotaItem.backgroundColor = undefined;
    }

    /**
     * 設定錯誤狀態 (對標 Cockpit setError)
     */
    public setError(message: string): void {
        this.quotaItem.text = `$(error) ${t('statusBar.quota.error') || 'Error'}`;
        this.quotaItem.tooltip = message;
        this.quotaItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    }

    /**
     * 設定離線狀態 (對標 Cockpit setOffline)
     */
    public setOffline(): void {
        this.quotaItem.text = `$(error) ${t('statusBar.quota.offline') || 'Offline'}`;
        this.quotaItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    }

    /**
     * 更新配額顯示 (對標 Cockpit update)
     * 使用單一 quotaItem 顯示所有模型配額
     */
    public updateQuota(data: QuotaData): void {
        this.currentQuotaData = data;

        if (!data.models || data.models.length === 0) {
            this.quotaItem.text = `$(rocket) No Data`;
            return;
        }

        // 格式化配額文字（對標 Cockpit 的顯示方式）
        const config = vscode.workspace.getConfiguration('antigravity-plus');
        const format = config.get<StatusBarFormat>('quotaMonitor.displayStyle') || 'iconNamePercentage';

        const parts: string[] = [];
        let minPercentage = 100;

        // 最多顯示 3 個模型，超過則顯示最低配額的
        const displayModels = data.models.slice(0, 3);

        for (const model of displayModels) {
            const remaining = 100 - model.percentage;
            const icon = this.getStatusIcon(remaining);
            const shortName = this.getShortName(model.displayName);

            // 根據格式顯示
            let text: string;
            switch (format) {
                case 'icon':
                    text = icon;
                    break;
                case 'percentage':
                    text = `${remaining}%`;
                    break;
                case 'iconPercentage':
                    text = `${icon} ${remaining}%`;
                    break;
                case 'namePercentage':
                    text = `${shortName}: ${remaining}%`;
                    break;
                case 'iconNamePercentage':
                default:
                    text = `${icon} ${shortName}: ${remaining}%`;
                    break;
            }

            parts.push(text);
            if (remaining < minPercentage) {
                minPercentage = remaining;
            }
        }

        // 設定 quotaItem 文字
        this.quotaItem.text = parts.join(' | ');
        this.quotaItem.backgroundColor = undefined;

        // 設定警告背景色
        if (minPercentage <= 10) {
            this.quotaItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        } else if (minPercentage <= 30) {
            this.quotaItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        }

        // 建立 tooltip
        this.quotaItem.tooltip = this.buildQuotaTooltip(data);

        // 同時更新 groups（保持向後相容）
        if (data.models.length > 0 && this.currentGroups.length === 0) {
            this.updateGroupsFromModels(data.models);
        }
    }

    /**
     * 建立配額 Tooltip
     */
    private buildQuotaTooltip(data: QuotaData): vscode.MarkdownString {
        const md = new vscode.MarkdownString();
        md.isTrusted = true;
        md.supportHtml = true;

        md.appendMarkdown(`**🚀 Antigravity Plus - Quota Monitor**\n\n`);

        // 表格標題
        md.appendMarkdown('| Model | Remaining | Reset |\n');
        md.appendMarkdown('| :--- | :--- | :--- |\n');

        for (const model of data.models) {
            const remaining = 100 - model.percentage;
            const icon = this.getStatusIcon(remaining);
            const resetTime = model.resetTime
                ? model.resetTime.toLocaleTimeString()
                : '-';
            md.appendMarkdown(`| ${icon} **${model.displayName}** | ${remaining}% | ${resetTime} |\n`);
        }

        md.appendMarkdown(`\n---\n*Click to open Dashboard*`);
        return md;
    }

    /**
     * 從分組管理器更新群組
     */
    public updateGroups(groups: QuotaGroup[]): void {
        this.currentGroups = groups;
        this.renderGroupItems();
    }

    /**
     * 從模型清單建立預設群組
     */
    private updateGroupsFromModels(models: ModelQuota[]): void {
        // 簡化版：每個模型一個群組（實際應由 GroupingManager 處理）
        const groups: QuotaGroup[] = models.slice(0, this.MAX_GROUPS).map((m, i) => ({
            id: m.name,
            name: m.name,
            displayName: m.displayName,
            models: [m],
            aggregatedQuota: {
                used: m.used,
                total: m.total,
                percentage: m.percentage
            },
            resetTime: m.resetTime,
            isPinned: false,
            order: i
        }));

        this.currentGroups = groups;
        this.renderGroupItems();
    }

    /**
     * 渲染群組項目
     */
    private renderGroupItems(): void {
        // 清除舊項目
        this.groupItems.forEach(item => item.dispose());
        this.groupItems = [];

        const config = vscode.workspace.getConfiguration('antigravity-plus');
        const format = config.get<StatusBarFormat>('quotaMonitor.displayStyle') || 'iconPercentage';

        // 建立新項目 (優先級從 100 開始，遞減)
        this.currentGroups.forEach((group, index) => {
            const item = vscode.window.createStatusBarItem(
                vscode.StatusBarAlignment.Right,
                100 - index
            );

            const remaining = 100 - group.aggregatedQuota.percentage;
            const icon = this.getStatusIcon(remaining);
            const text = this.formatGroupText(group.displayName, remaining, format);

            item.text = text;
            item.tooltip = this.buildGroupTooltip(group);
            item.command = 'antigravity-plus.openDashboard';

            // 設定背景色
            if (remaining <= 10) {
                item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
            } else if (remaining <= 30) {
                item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
            }

            item.show();
            this.groupItems.push(item);
            this.context.subscriptions.push(item);
        });
    }

    /**
     * 格式化群組文字
     */
    private formatGroupText(name: string, percent: number, format: StatusBarFormat): string {
        const icon = this.getStatusIcon(percent);
        const shortName = this.getShortName(name);

        switch (format) {
            case 'icon':
                return icon;
            case 'percentage':
                return `${percent}%`;
            case 'iconPercentage':
                return `${icon} ${percent}%`;
            case 'namePercentage':
                return `${shortName}: ${percent}%`;
            case 'iconNamePercentage':
                return `${icon} ${shortName}: ${percent}%`;
            case 'progressBar':
                return this.formatProgressBar(percent);
            default:
                return `${icon} ${shortName}: ${percent}%`;
        }
    }

    /**
     * 取得狀態圖示
     */
    public getStatusIcon(percent: number): string {
        if (percent >= 50) return '🟢';
        if (percent >= 20) return '🟡';
        return '🔴';
    }

    /**
     * 取得縮短名稱
     */
    private getShortName(name: string): string {
        const shortNames: Record<string, string> = {
            'Gemini 3 Pro': 'Pro',
            'Gemini 3 Flash': 'Flash',
            'Gemini Pro': 'Pro',
            'Gemini Flash': 'Flash',
            'Claude Sonnet': 'Sonnet',
            'Claude Opus': 'Opus',
            'GPT-4o': '4o',
            'GPT-4o Mini': '4o-mini'
        };
        return shortNames[name] || name.split(' ').pop() || name;
    }

    /**
     * 格式化進度條
     */
    private formatProgressBar(percent: number): string {
        const filled = Math.round(percent / 12.5);
        const empty = 8 - filled;
        return '█'.repeat(filled) + '░'.repeat(empty);
    }

    /**
     * 建立群組 tooltip
     */
    private buildGroupTooltip(group: QuotaGroup): string {
        const remaining = 100 - group.aggregatedQuota.percentage;
        const lines = [
            `📊 ${group.displayName}`,
            `━━━━━━━━━━━━━━━━━━━━`,
            `${this.getStatusIcon(remaining)} Remaining: ${remaining}%`,
            `Used: ${group.aggregatedQuota.used} / ${group.aggregatedQuota.total}`,
        ];

        if (group.resetTime) {
            const countdown = calculateCountdown(group.resetTime);
            lines.push(``, `⏱ Resets in: ${countdown.text}`);
        }

        if (group.models.length > 1) {
            lines.push(``, `📦 Includes ${group.models.length} models`);
        }

        return lines.join('\n');
    }

    // ========== Session (Legacy) ==========

    /**
     * 更新 Session 顯示 (可選，若要保留)
     */
    public updateSession(session: UsageSession): void {
        // Session 項目已移除，統計由 Dashboard 顯示
    }

    // ========== Countdown Timer ==========

    /**
     * 啟動倒數計時更新
     */
    private startCountdownUpdates(): void {
        this.countdownTimer = setInterval(() => {
            // 更新群組的 tooltip
            if (this.currentGroups.length > 0) {
                this.renderGroupItems();
            }
        }, 60000); // 每分鐘更新一次
    }

    // ========== Utility ==========

    /**
     * 刷新顯示（語言變更時）
     */
    public refresh(): void {
        this.updateAutoApproveState(this.autoApproveEnabled);
        this.updateBackgroundState(this.backgroundEnabled);
        if (this.currentGroups.length > 0) {
            this.renderGroupItems();
        }
    }

    /**
     * 更新設定
     */
    public updateConfig(): void {
        if (this.currentGroups.length > 0) {
            this.renderGroupItems();
        }
    }

    /**
     * 釋放資源
     */
    public dispose(): void {
        if (this.countdownTimer) {
            clearInterval(this.countdownTimer);
        }
        this.autoApproveItem.dispose();
        this.backgroundItem.dispose();
        this.settingsItem.dispose();
        this.groupItems.forEach(item => item.dispose());
    }
}
