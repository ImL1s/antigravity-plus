/* eslint-disable */
/**
 * QuickPick Quota Display - 配額 QuickPick 備用模式
 * 
 * 對齊 Antigravity Cockpit 的 QuickPick 模式
 * - 當 Webview 無法加載時的備用方案
 * - 支援分組 / 非分組模式
 * - 標題欄按鈕：刷新、切換分組、開啟日誌、設定
 */

import * as vscode from 'vscode';
import { QuotaData, ModelQuota } from './controller';
import { GroupingManager, QuotaGroup } from './grouping';
import { calculateCountdown } from './countdown';
import { t } from '../../i18n';

interface QuotaQuickPickItem extends vscode.QuickPickItem {
    modelId?: string;
    groupId?: string;
    action?: 'refresh' | 'toggleGroup' | 'pin' | 'rename' | 'settings';
}

export class QuickPickQuotaDisplay implements vscode.Disposable {
    private disposables: vscode.Disposable[] = [];
    private groupingEnabled: boolean = true;

    constructor(
        private groupingManager: GroupingManager
    ) { }

    /**
     * 顯示配額 QuickPick
     */
    public async show(quotaData: QuotaData): Promise<void> {
        const quickPick = vscode.window.createQuickPick<QuotaQuickPickItem>();
        quickPick.title = '📊 Antigravity Plus - Quota Monitor';
        quickPick.placeholder = t('quickpick.placeholder') || 'Select a model to view details or pin to status bar';
        quickPick.matchOnDescription = true;
        quickPick.matchOnDetail = true;

        // 建立項目
        quickPick.items = this.buildItems(quotaData);

        // 設定按鈕
        quickPick.buttons = [
            {
                iconPath: new vscode.ThemeIcon('refresh'),
                tooltip: t('quickpick.refresh') || 'Refresh Quota'
            },
            {
                iconPath: new vscode.ThemeIcon(this.groupingEnabled ? 'list-tree' : 'list-flat'),
                tooltip: this.groupingEnabled
                    ? (t('quickpick.disableGrouping') || 'Disable Grouping')
                    : (t('quickpick.enableGrouping') || 'Enable Grouping')
            },
            {
                iconPath: new vscode.ThemeIcon('gear'),
                tooltip: t('quickpick.settings') || 'Settings'
            }
        ];

        quickPick.onDidAccept(async () => {
            const selected = quickPick.selectedItems[0];
            if (!selected) return;

            if (selected.action === 'pin' && selected.modelId) {
                // 置頂模型
                await this.pinModel(selected.modelId);
                vscode.window.showInformationMessage(`📌 ${selected.modelId} pinned to status bar`);
            } else if (selected.action === 'pin' && selected.groupId) {
                // 置頂分組
                this.groupingManager.togglePin(selected.groupId);
                vscode.window.showInformationMessage(`📌 Group pinned`);
            } else if (selected.action === 'rename' && selected.groupId) {
                // 重命名分組
                const newName = await vscode.window.showInputBox({
                    // Remove icons from start of label (Bar, Red, Yellow, Green, White circles)
                    // using Unicode ranges or explicit code points to avoid source-code surrogates
                    value: selected.label.replace(new RegExp(`^[${String.fromCodePoint(0x1F4CA, 0x1F534, 0x1F7E1, 0x1F7E2, 0x26AA)}] `), '')
                });
                if (newName) {
                    this.groupingManager.rename(selected.groupId, newName);
                    vscode.window.showInformationMessage(`✏️ Group renamed to ${newName}`);
                }
            }

            quickPick.hide();
        });

        quickPick.onDidTriggerButton(async (button) => {
            if (button.tooltip?.includes('Refresh')) {
                // 刷新
                await vscode.commands.executeCommand('antigravity-plus.refreshQuota');
                quickPick.hide();
            } else if (button.tooltip?.includes('Grouping')) {
                // 切換分組
                this.groupingEnabled = !this.groupingEnabled;
                quickPick.items = this.buildItems(quotaData);
                quickPick.buttons = this.updateButtons();
            } else if (button.tooltip?.includes('Settings')) {
                // 開啟設定
                await vscode.commands.executeCommand('workbench.action.openSettings', 'antigravity-plus.quota');
                quickPick.hide();
            }
        });

        quickPick.onDidHide(() => {
            quickPick.dispose();
        });

        quickPick.show();
    }

    /**
     * 建立 QuickPick 項目
     */
    private buildItems(quotaData: QuotaData): QuotaQuickPickItem[] {
        const items: QuotaQuickPickItem[] = [];

        if (!quotaData.models || quotaData.models.length === 0) {
            items.push({
                label: '$(warning) No quota data available',
                description: 'Click refresh to load quota'
            });
            return items;
        }

        if (this.groupingEnabled) {
            // 分組模式
            const groups = this.groupingManager.createGroups(quotaData.models);

            for (const group of groups) {
                // 分組標題
                const icon = this.getStatusIcon(100 - group.aggregatedQuota.percentage);
                const countdown = group.resetTime ? calculateCountdown(group.resetTime) : '';

                items.push({
                    label: `${icon} ${group.displayName}`,
                    description: `${100 - group.aggregatedQuota.percentage}% remaining`,
                    detail: countdown ? `⏱️ Resets ${countdown}` : undefined,
                    groupId: group.id,
                    kind: vscode.QuickPickItemKind.Separator
                });

                // 分組內的模型
                for (const model of group.models) {
                    const modelIcon = this.getStatusIcon(model.remainingPercentage ?? (100 - model.percentage));
                    items.push({
                        label: `    ${modelIcon} ${model.name}`,
                        description: `${model.remainingPercentage ?? (100 - model.percentage)}%`,
                        detail: model.resetTime ? `Resets ${calculateCountdown(model.resetTime)}` : undefined,
                        modelId: model.name,
                        action: 'pin'
                    });
                }
            }
        } else {
            // 平面模式
            const sortedModels = [...quotaData.models].sort((a, b) =>
                (a.remainingPercentage ?? (100 - a.percentage)) - (b.remainingPercentage ?? (100 - b.percentage))
            );

            for (const model of sortedModels) {
                const remainingPct = model.remainingPercentage ?? (100 - model.percentage);
                const icon = this.getStatusIcon(remainingPct);
                const countdown = model.resetTime ? calculateCountdown(model.resetTime) : '';

                items.push({
                    label: `${icon} ${model.name}`,
                    description: `${remainingPct}% remaining`,
                    detail: countdown ? `⏱️ Resets ${countdown}` : undefined,
                    modelId: model.name,
                    action: 'pin'
                });
            }
        }

        return items;
    }

    /**
     * 更新按鈕
     */
    private updateButtons(): vscode.QuickInputButton[] {
        return [
            {
                iconPath: new vscode.ThemeIcon('refresh'),
                tooltip: t('quickpick.refresh') || 'Refresh Quota'
            },
            {
                iconPath: new vscode.ThemeIcon(this.groupingEnabled ? 'list-tree' : 'list-flat'),
                tooltip: this.groupingEnabled
                    ? (t('quickpick.disableGrouping') || 'Disable Grouping')
                    : (t('quickpick.enableGrouping') || 'Enable Grouping')
            },
            {
                iconPath: new vscode.ThemeIcon('gear'),
                tooltip: t('quickpick.settings') || 'Settings'
            }
        ];
    }

    /**
     * 取得狀態圖示
     */
    private getStatusIcon(percent: number): string {
        if (percent >= 50) return '🟢';
        if (percent >= 20) return '🟡';
        if (percent > 0) return '🔴';
        return '⚪';
    }

    /**
     * 置頂模型到狀態列
     */
    private async pinModel(modelId: string): Promise<void> {
        const config = vscode.workspace.getConfiguration('antigravity-plus.quota');
        const pinnedModels = config.get<string[]>('pinnedModels') || [];

        if (!pinnedModels.includes(modelId)) {
            pinnedModels.push(modelId);
            await config.update('pinnedModels', pinnedModels, vscode.ConfigurationTarget.Global);
        }
    }

    public dispose(): void {
        this.disposables.forEach(d => d.dispose());
    }
}
