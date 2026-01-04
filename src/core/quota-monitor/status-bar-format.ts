/**
 * Status Bar Format - 狀態列格式化模組
 * 
 * 對齊 Antigravity Cockpit 的 6 種狀態列格式：
 * 1. 🚀 - 僅圖示
 * 2. 🟢 - 顏色圖示
 * 3. 95% - 僅百分比
 * 4. 🟢 95% - 圖示 + 百分比
 * 5. Sonnet: 95% - 模型名 + 百分比
 * 6. 🟢 Sonnet: 95% - 完整格式
 */

import * as vscode from 'vscode';
import { ModelQuota } from './controller';
import { QuotaGroup } from './grouping';

export type StatusBarFormat =
    | 'icon-only'        // 🚀
    | 'color-icon'       // 🟢
    | 'percent-only'     // 95%
    | 'icon-percent'     // 🟢 95%
    | 'name-percent'     // Sonnet: 95%
    | 'full';            // 🟢 Sonnet: 95%

export interface StatusBarConfig {
    format: StatusBarFormat;
    warningThreshold: number;   // 低於此值顯示黃色 (預設 30)
    criticalThreshold: number;  // 低於此值顯示紅色 (預設 10)
    pinnedModels: string[];     // 置頂的模型
    pinnedGroups: string[];     // 置頂的分組
    showLowest: boolean;        // 未置頂時顯示最低配額
}

const DEFAULT_CONFIG: StatusBarConfig = {
    format: 'icon-percent',
    warningThreshold: 30,
    criticalThreshold: 10,
    pinnedModels: [],
    pinnedGroups: [],
    showLowest: true
};

export interface IConfigProvider {
    get<T>(key: string, defaultValue?: T): T | undefined;
    update(key: string, value: any): PromiseLike<void>;
}

export class StatusBarFormatter {
    private config: StatusBarConfig;
    private configProvider: IConfigProvider;

    constructor(configProvider?: IConfigProvider) {
        this.configProvider = configProvider || {
            get: (key: string, defaultValue?: any) => {
                return vscode.workspace.getConfiguration('antigravity-plus.quota').get(key, defaultValue);
            },
            update: (key: string, value: any) => {
                return vscode.workspace.getConfiguration('antigravity-plus.quota').update(key, value, vscode.ConfigurationTarget.Global);
            }
        };
        this.config = this.loadConfig();
    }

    /**
     * 格式化單個模型的狀態列文字
     */
    public formatModel(model: ModelQuota): string {
        const percent = model.remainingPercentage ?? (100 - model.percentage);
        const icon = this.getColorIcon(percent);
        const name = this.getShortName(model.name);

        switch (this.config.format) {
            case 'icon-only':
                return '🚀';
            case 'color-icon':
                return icon;
            case 'percent-only':
                return `${percent}%`;
            case 'icon-percent':
                return `${icon} ${percent}%`;
            case 'name-percent':
                return `${name}: ${percent}%`;
            case 'full':
            default:
                return `${icon} ${name}: ${percent}%`;
        }
    }

    /**
     * 格式化分組的狀態列文字
     */
    public formatGroup(group: QuotaGroup): string {
        const percent = 100 - group.aggregatedQuota.percentage;
        const icon = this.getColorIcon(percent);
        const name = this.getShortName(group.displayName);

        switch (this.config.format) {
            case 'icon-only':
                return '🚀';
            case 'color-icon':
                return icon;
            case 'percent-only':
                return `${percent}%`;
            case 'icon-percent':
                return `${icon} ${percent}%`;
            case 'name-percent':
                return `${name}: ${percent}%`;
            case 'full':
            default:
                return `${icon} ${name}: ${percent}%`;
        }
    }

    /**
     * 格式化多個模型（置頂模式）
     */
    public formatMultiple(models: ModelQuota[]): string {
        if (models.length === 0) return '🚀';
        if (models.length === 1) return this.formatModel(models[0]);

        // 多個模型時，簡化顯示
        const parts = models.slice(0, 3).map(m => {
            const icon = this.getColorIcon(m.remainingPercentage ?? (100 - m.percentage));
            const name = this.getShortName(m.name).slice(0, 3);
            return `${icon}${name}`;
        });

        if (models.length > 3) {
            parts.push(`+${models.length - 3}`);
        }

        return parts.join(' ');
    }

    /**
     * 取得顏色圖示
     */
    public getColorIcon(percent: number): string {
        if (percent <= this.config.criticalThreshold) return '🔴';
        if (percent <= this.config.warningThreshold) return '🟡';
        return '🟢';
    }

    /**
     * 取得簡短名稱
     */
    private getShortName(name: string): string {
        // 常見模型簡稱
        const shortNames: [string, string][] = [
            ['claude-3-5-sonnet', 'Sonnet'],
            ['claude-sonnet-4', 'Sonnet'],
            ['claude-3-opus', 'Opus'],
            ['gemini-2.5-pro', 'Gemini Pro'],
            ['gemini-2.5-flash', 'Gemini Flash'],
            ['gpt-4o', 'GPT-4o'],
            ['gpt-4o-mini', 'GPT-4o Mini']
        ];

        // 嘗試匹配
        for (const [pattern, short] of shortNames) {
            if (name.toLowerCase().includes(pattern.toLowerCase())) {
                return short;
            }
        }

        // Fallback: 取前 10 個字元
        return name.length > 10 ? name.slice(0, 8) + '…' : name;
    }

    /**
     * 取得當前格式
     */
    public getFormat(): StatusBarFormat {
        return this.config.format;
    }

    /**
     * 設定格式
     */
    public setFormat(format: StatusBarFormat): void {
        this.config.format = format;
        this.saveConfig();
    }

    /**
     * 取得設定
     */
    public getConfig(): StatusBarConfig {
        return { ...this.config };
    }

    /**
     * 更新設定
     */
    public updateConfig(updates: Partial<StatusBarConfig>): void {
        this.config = { ...this.config, ...updates };
        this.saveConfig();
    }

    /**
     * 取得所有可用格式
     */
    public static getAvailableFormats(): { id: StatusBarFormat; label: string; example: string }[] {
        return [
            { id: 'icon-only', label: 'Icon Only', example: '🚀' },
            { id: 'color-icon', label: 'Color Icon', example: '🟢' },
            { id: 'percent-only', label: 'Percent Only', example: '95%' },
            { id: 'icon-percent', label: 'Icon + Percent', example: '🟢 95%' },
            { id: 'name-percent', label: 'Name + Percent', example: 'Sonnet: 95%' },
            { id: 'full', label: 'Full Format', example: '🟢 Sonnet: 95%' }
        ];
    }

    /**
     * 載入設定
     */
    private loadConfig(): StatusBarConfig {
        return {
            format: this.configProvider.get<StatusBarFormat>('statusBarFormat') || DEFAULT_CONFIG.format,
            warningThreshold: this.configProvider.get<number>('warningThreshold') || DEFAULT_CONFIG.warningThreshold,
            criticalThreshold: this.configProvider.get<number>('criticalThreshold') || DEFAULT_CONFIG.criticalThreshold,
            pinnedModels: this.configProvider.get<string[]>('pinnedModels') || DEFAULT_CONFIG.pinnedModels,
            pinnedGroups: this.configProvider.get<string[]>('pinnedGroups') || DEFAULT_CONFIG.pinnedGroups,
            showLowest: this.configProvider.get<boolean>('showLowest') ?? DEFAULT_CONFIG.showLowest
        };
    }

    /**
     * 儲存設定
     */
    private saveConfig(): void {
        this.configProvider.update('statusBarFormat', this.config.format);
        this.configProvider.update('warningThreshold', this.config.warningThreshold);
        this.configProvider.update('criticalThreshold', this.config.criticalThreshold);
        this.configProvider.update('pinnedModels', this.config.pinnedModels);
        this.configProvider.update('pinnedGroups', this.config.pinnedGroups);
        this.configProvider.update('showLowest', this.config.showLowest);
    }

    /**
     * 刷新設定
     */
    public refresh(): void {
        this.config = this.loadConfig();
    }
}
