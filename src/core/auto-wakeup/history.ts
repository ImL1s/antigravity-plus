/**
 * Wakeup History - 歷史記錄
 */

import * as vscode from 'vscode';

export interface WakeupHistoryEntry {
    timestamp: Date;
    model: string;
    success: boolean;
    tokensUsed: number;
    error?: string;
}

const STORAGE_KEY = 'antigravity-plus.wakeupHistory';
const MAX_ENTRIES = 100;

export class WakeupHistory {
    private entries: WakeupHistoryEntry[] = [];

    constructor(private context: vscode.ExtensionContext) {
        this.load();
    }

    /**
     * 新增記錄
     */
    public add(entry: WakeupHistoryEntry): void {
        this.entries.unshift(entry);

        // 限制數量
        if (this.entries.length > MAX_ENTRIES) {
            this.entries = this.entries.slice(0, MAX_ENTRIES);
        }

        this.save();
    }

    /**
     * 取得所有記錄
     */
    public getAll(): WakeupHistoryEntry[] {
        return [...this.entries];
    }

    /**
     * 取得最近 N 筆記錄
     */
    public getRecent(count: number): WakeupHistoryEntry[] {
        return this.entries.slice(0, count);
    }

    /**
     * 取得成功次數
     */
    public getSuccessCount(): number {
        return this.entries.filter(e => e.success).length;
    }

    /**
     * 取得失敗次數
     */
    public getFailureCount(): number {
        return this.entries.filter(e => !e.success).length;
    }

    /**
     * 取得總 tokens 使用量
     */
    public getTotalTokensUsed(): number {
        return this.entries.reduce((sum, e) => sum + e.tokensUsed, 0);
    }

    /**
     * 取得最後一次執行
     */
    public getLastEntry(): WakeupHistoryEntry | null {
        return this.entries[0] || null;
    }

    /**
     * 清除歷史
     */
    public clear(): void {
        this.entries = [];
        this.save();
    }

    /**
     * 載入
     */
    private load(): void {
        const saved = this.context.globalState.get<WakeupHistoryEntry[]>(STORAGE_KEY);
        if (saved) {
            this.entries = saved.map(e => ({
                ...e,
                timestamp: new Date(e.timestamp)
            }));
        }
    }

    /**
     * 儲存
     */
    private save(): void {
        this.context.globalState.update(STORAGE_KEY, this.entries);
    }
}
