/**
 * 配額分組管理
 * 
 * 參考 Antigravity Cockpit 的分組功能
 * 
 * 將共享配額池的模型分組顯示
 */

import * as vscode from 'vscode';
import { ModelQuota } from './controller';
import { t } from '../../i18n';

export interface QuotaGroup {
    id: string;
    name: string;
    displayName: string;
    models: ModelQuota[];
    aggregatedQuota: {
        used: number;
        total: number;
        percentage: number;
    };
    resetTime?: Date;
    isPinned: boolean;
    order: number;
}

export interface GroupingConfig {
    enabled: boolean;
    customNames: Record<string, string>;
    pinnedGroups: string[];
    groupOrder: string[];
}

export class GroupingManager {
    private groups: Map<string, QuotaGroup> = new Map();
    private config: GroupingConfig;
    private readonly STORAGE_KEY = 'antigravity-plus.groupingConfig';

    constructor(private context: vscode.ExtensionContext) {
        this.config = this.loadConfig();
    }

    /**
     * 根據模型建立分組 (對標 Cockpit 動態分組邏輯)
     */
    public createGroups(models: ModelQuota[]): QuotaGroup[] {
        this.groups.clear();

        // ✅ 對標 Cockpit: 基於 remainingFraction + resetTime 動態分組
        const poolMap = new Map<string, ModelQuota[]>();

        for (const model of models) {
            // 生成動態 groupId (Cockpit 方式)
            const groupId = this.generateGroupId(model);

            if (!poolMap.has(groupId)) {
                poolMap.set(groupId, []);
            }
            poolMap.get(groupId)!.push(model);
        }

        // 建立分組物件
        let order = 0;
        for (const [pool, poolModels] of poolMap) {
            const group = this.createGroup(pool, poolModels, order++);
            this.groups.set(group.id, group);
        }

        // 套用自訂順序
        return this.getSortedGroups();
    }

    /**
     * 生成動態 groupId (對標 Cockpit reactor.ts:531)
     * 
     * 基於 remainingFraction + resetTime 生成簽名，
     * 共享相同配額池的模型會自動歸為同一組
     */
    private generateGroupId(model: ModelQuota): string {
        // 如果有精確的 remainingFraction，使用 Cockpit 方式
        if (model.remainingFraction !== undefined && model.resetTime) {
            const fraction = model.remainingFraction;
            const resetTime = model.resetTime.getTime();
            return `${fraction.toFixed(6)}_${resetTime}`;
        }

        // Fallback: 使用舊的靜態映射
        return this.getPoolForModel(model.name);
    }

    /**
     * 取得模型的配額池 (Fallback 靜態映射)
     */
    private getPoolForModel(modelName: string): string {
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

    /**
     * 建立分組物件
     */
    private createGroup(pool: string, models: ModelQuota[], order: number): QuotaGroup {
        // 計算聚合配額
        const totalUsed = models.reduce((sum, m) => sum + m.used, 0);
        const totalLimit = models.reduce((sum, m) => sum + m.total, 0);
        const percentage = totalLimit > 0 ? Math.round((totalUsed / totalLimit) * 100) : 0;

        // 找最早的重置時間
        const resetTimes = models
            .filter(m => m.resetTime)
            .map(m => m.resetTime!.getTime());
        const earliestReset = resetTimes.length > 0 ? new Date(Math.min(...resetTimes)) : undefined;

        return {
            id: pool,
            name: pool,
            displayName: this.config.customNames[pool] || this.getDefaultDisplayName(pool),
            models,
            aggregatedQuota: {
                used: totalUsed,
                total: totalLimit,
                percentage
            },
            resetTime: earliestReset,
            isPinned: this.config.pinnedGroups.includes(pool),
            order: this.config.groupOrder.indexOf(pool) !== -1
                ? this.config.groupOrder.indexOf(pool)
                : order + 1000 // 未排序的放後面
        };
    }

    /**
     * 取得預設顯示名稱
     */
    private getDefaultDisplayName(pool: string): string {
        const displayNames: Record<string, string> = {
            'gemini-pro': 'Gemini Pro',
            'gemini-flash': 'Gemini Flash',
            'claude-sonnet': 'Claude Sonnet',
            'claude-opus': 'Claude Opus',
            'gpt-4o': 'GPT-4o',
            'gpt-4o-mini': 'GPT-4o Mini',
            'ungrouped': t('grouping.ungrouped')
        };

        return displayNames[pool] || pool;
    }

    /**
     * 取得排序後的分組
     */
    public getSortedGroups(): QuotaGroup[] {
        const groups = Array.from(this.groups.values());

        // 排序：置頂的優先，然後按 order
        return groups.sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            return a.order - b.order;
        });
    }

    /**
     * 取得單個分組
     */
    public getGroup(id: string): QuotaGroup | undefined {
        return this.groups.get(id);
    }

    /**
     * 置頂/取消置頂分組
     */
    public togglePin(groupId: string): boolean {
        const group = this.groups.get(groupId);
        if (!group) return false;

        if (this.config.pinnedGroups.includes(groupId)) {
            this.config.pinnedGroups = this.config.pinnedGroups.filter(id => id !== groupId);
            group.isPinned = false;
        } else {
            this.config.pinnedGroups.push(groupId);
            group.isPinned = true;
        }

        this.saveConfig();
        return group.isPinned;
    }

    /**
     * 重新命名分組
     */
    public rename(groupId: string, newName: string): void {
        const group = this.groups.get(groupId);
        if (!group) return;

        this.config.customNames[groupId] = newName;
        group.displayName = newName;

        this.saveConfig();
    }

    /**
     * 設定分組順序
     */
    public setOrder(groupIds: string[]): void {
        this.config.groupOrder = groupIds;

        // 更新各分組的 order
        groupIds.forEach((id, index) => {
            const group = this.groups.get(id);
            if (group) {
                group.order = index;
            }
        });

        this.saveConfig();
    }

    /**
     * 載入設定
     */
    private loadConfig(): GroupingConfig {
        const saved = this.context.globalState.get<GroupingConfig>(this.STORAGE_KEY);

        return {
            enabled: true,
            customNames: saved?.customNames || {},
            pinnedGroups: saved?.pinnedGroups || [],
            groupOrder: saved?.groupOrder || []
        };
    }

    /**
     * 儲存設定
     */
    private saveConfig(): void {
        this.context.globalState.update(this.STORAGE_KEY, this.config);
    }

    /**
     * 重置設定
     */
    public resetConfig(): void {
        this.config = {
            enabled: true,
            customNames: {},
            pinnedGroups: [],
            groupOrder: []
        };
        this.saveConfig();
    }
}
