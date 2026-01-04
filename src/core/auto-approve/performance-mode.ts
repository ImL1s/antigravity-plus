/**
 * Performance Mode - 效能模式控制器
 * 
 * 控制輪詢間隔：Instant (100ms) ↔ Battery Saving (1000ms)
 */

import * as vscode from 'vscode';

export type PerformanceLevel = 'instant' | 'fast' | 'normal' | 'battery';

export interface PerformanceConfig {
    level: PerformanceLevel;
    customIntervalMs?: number;
}

const INTERVAL_MAP: Record<PerformanceLevel, number> = {
    'instant': 100,
    'fast': 200,
    'normal': 500,
    'battery': 1000
};

const STORAGE_KEY = 'antigravity-plus.performanceConfig';

export class PerformanceModeController implements vscode.Disposable {
    private config: PerformanceConfig;
    private onChangeListeners: Array<(interval: number) => void> = [];

    constructor(private context: vscode.ExtensionContext) {
        this.config = this.loadConfig();
    }

    /**
     * 取得當前輪詢間隔（毫秒）
     */
    public getInterval(): number {
        if (this.config.customIntervalMs !== undefined) {
            return this.config.customIntervalMs;
        }
        return INTERVAL_MAP[this.config.level];
    }

    /**
     * 取得當前效能等級
     */
    public getLevel(): PerformanceLevel {
        return this.config.level;
    }

    /**
     * 設定效能等級
     */
    public setLevel(level: PerformanceLevel): void {
        this.config.level = level;
        this.config.customIntervalMs = undefined;
        this.saveConfig();
        this.notifyChange();
    }

    /**
     * 設定自訂間隔
     */
    public setCustomInterval(intervalMs: number): void {
        // 限制範圍 50ms ~ 2000ms
        const clamped = Math.max(50, Math.min(2000, intervalMs));
        this.config.customIntervalMs = clamped;
        this.saveConfig();
        this.notifyChange();
    }

    /**
     * 從滑桿值設定（0-100）
     */
    public setFromSlider(value: number): void {
        // 0 = Instant (100ms), 100 = Battery (1000ms)
        // 使用對數刻度讓低延遲端更精細
        const minLog = Math.log(100);
        const maxLog = Math.log(1000);
        const scale = (maxLog - minLog) / 100;
        const intervalMs = Math.round(Math.exp(minLog + scale * value));

        this.config.customIntervalMs = intervalMs;

        // 同時更新等級標籤
        if (intervalMs <= 150) {
            this.config.level = 'instant';
        } else if (intervalMs <= 350) {
            this.config.level = 'fast';
        } else if (intervalMs <= 750) {
            this.config.level = 'normal';
        } else {
            this.config.level = 'battery';
        }

        this.saveConfig();
        this.notifyChange();
    }

    /**
     * 取得滑桿值（0-100）
     */
    public getSliderValue(): number {
        const interval = this.getInterval();
        const minLog = Math.log(100);
        const maxLog = Math.log(1000);
        const scale = (maxLog - minLog) / 100;
        return Math.round((Math.log(interval) - minLog) / scale);
    }

    /**
     * 取得等級的顯示名稱
     */
    public getLevelDisplayName(): string {
        const names: Record<PerformanceLevel, string> = {
            'instant': 'Instant',
            'fast': 'Fast',
            'normal': 'Normal',
            'battery': 'Battery Saving'
        };
        return names[this.config.level];
    }

    /**
     * 取得當前間隔的顯示文字
     */
    public getIntervalDisplay(): string {
        const interval = this.getInterval();
        if (interval < 1000) {
            return `${interval}ms`;
        }
        return `${(interval / 1000).toFixed(1)}s`;
    }

    /**
     * 監聽變更
     */
    public onChange(listener: (interval: number) => void): vscode.Disposable {
        this.onChangeListeners.push(listener);
        return {
            dispose: () => {
                const index = this.onChangeListeners.indexOf(listener);
                if (index >= 0) {
                    this.onChangeListeners.splice(index, 1);
                }
            }
        };
    }

    /**
     * 通知變更
     */
    private notifyChange(): void {
        const interval = this.getInterval();
        this.onChangeListeners.forEach(listener => listener(interval));
    }

    /**
     * 載入設定
     */
    private loadConfig(): PerformanceConfig {
        const saved = this.context.globalState.get<PerformanceConfig>(STORAGE_KEY);
        return saved || { level: 'fast' }; // 預設 Fast (200ms)
    }

    /**
     * 儲存設定
     */
    private saveConfig(): void {
        this.context.globalState.update(STORAGE_KEY, this.config);
    }

    /**
     * 釋放資源
     */
    public dispose(): void {
        this.onChangeListeners = [];
    }
}
