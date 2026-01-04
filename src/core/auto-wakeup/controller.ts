/**
 * Auto Wake-up Controller - 自動喚醒控制器
 * 
 * 排程觸發配額重置計時器
 * 支援常駐模式和系統排程
 */

import * as vscode from 'vscode';
import { Logger } from '../../utils/logger';
import { WakeupScheduler } from './scheduler';
import { SystemScheduler } from './system-scheduler';
import { WakeupTrigger } from './trigger';
import { WakeupHistory, WakeupHistoryEntry } from './history';
import { QuotaMonitorController } from '../quota-monitor/controller';  // Imported dependency

export interface WakeupConfig {
    enabled: boolean;
    mode: 'smart' | 'fixed' | 'cron';
    workStartTime: string;        // HH:mm 格式
    fixedTimes: string[];         // HH:mm 格式陣列
    cronExpression: string;
    models: string[];
    useSystemScheduler: boolean;
    useResident: boolean;
    notificationWebhook?: string;
}

const DEFAULT_CONFIG: WakeupConfig = {
    enabled: false,
    mode: 'smart',
    workStartTime: '09:00',
    fixedTimes: ['06:00'],
    cronExpression: '0 6 * * *',
    models: ['gemini-3-flash'],
    useSystemScheduler: true,
    useResident: true
};

const CONFIG_KEY = 'antigravity-plus.wakeupConfig';

export class AutoWakeupController implements vscode.Disposable {
    private config: WakeupConfig;
    private scheduler: WakeupScheduler;
    private systemScheduler: SystemScheduler;
    private trigger: WakeupTrigger;
    private history: WakeupHistory;
    private isRunning = false;

    constructor(
        private context: vscode.ExtensionContext,
        private logger: Logger,
        private quotaMonitor: QuotaMonitorController, // Injected dependency
        private statusBarManager?: any // Optional injection for now, will type properly if import available
    ) {
        this.config = this.loadConfig();
        this.scheduler = new WakeupScheduler(logger);
        this.systemScheduler = new SystemScheduler(logger);
        this.trigger = new WakeupTrigger(logger, context);
        this.history = new WakeupHistory(context);

        // 綁定排程器回調
        this.scheduler.onTrigger(() => this.executeWakeup());
    }

    /**
     * 設定 StatusBarManager (如果無法在構造函數中注入)
     */
    public setStatusBarManager(manager: any) {
        this.statusBarManager = manager;
    }

    /**
     * 啟動服務
     */
    public async start(): Promise<void> {
        if (!this.config.enabled) {
            this.logger.info('Auto Wake-up 未啟用');
            return;
        }

        this.isRunning = true;
        const nextTime = this.calculateNextTriggerTime();

        // 1. 常駐排程
        if (this.config.useResident) {
            this.scheduler.schedule(nextTime);
            this.logger.info(`常駐排程已設定: ${nextTime.toLocaleString()}`);
        }

        // 2. 系統排程
        if (this.config.useSystemScheduler) {
            await this.systemScheduler.createTask(this.config);
            this.logger.info('系統排程已建立');
        }

        // 3. UI 更新
        this.updateStatusBar(nextTime);
    }

    /**
     * 停止服務
     */
    public async stop(): Promise<void> {
        this.isRunning = false;
        this.scheduler.cancel();

        if (this.config.useSystemScheduler) {
            await this.systemScheduler.removeTask();
        }

        this.logger.info('Auto Wake-up 已停止');
    }

    /**
     * 更新狀態列
     */
    private updateStatusBar(nextRun: Date) {
        if (this.statusBarManager && this.statusBarManager.updateBackgroundState) {
            this.statusBarManager.updateBackgroundState(this.isRunning, nextRun);
        }
    }

    /**
     * 執行喚醒
     */
    private async executeWakeup(): Promise<void> {
        this.logger.info('開始執行 Auto Wake-up...');

        const startTime = new Date();
        let success = false;
        let error: string | undefined;
        let tokensUsed = 0;
        const model = this.selectModel();

        try {
            const result = await this.trigger.execute(model);
            success = result.success;
            tokensUsed = result.tokensUsed || 0;

            if (result.success) {
                this.logger.info(`Auto Wake-up 成功! 使用模型: ${model}, Tokens: ${tokensUsed}`);
                // 發送 Webhook 通知
                await this.sendNotification(true, model, tokensUsed);
            } else {
                error = result.error;
                this.logger.warn(`Auto Wake-up 失敗: ${error}`);
                await this.sendNotification(false, model, 0, error);
            }
        } catch (e) {
            error = e instanceof Error ? e.message : String(e);
            this.logger.error(`Auto Wake-up 異常: ${error}`);
            await this.sendNotification(false, model, 0, error);
        }

        // 記錄歷史
        this.history.add({
            timestamp: startTime,
            model,
            success,
            tokensUsed,
            error
        });

        // 排程下一次
        if (this.isRunning && this.config.useResident) {
            const nextTime = this.calculateNextTriggerTime();
            this.scheduler.schedule(nextTime);
            this.logger.info(`下次喚醒: ${nextTime.toLocaleString()}`);
            this.updateStatusBar(nextTime);
        }
    }

    /**
     * 發送通知
     */
    private async sendNotification(success: boolean, model: string, tokens: number, error?: string): Promise<void> {
        if (!this.config.notificationWebhook) return;

        try {
            const payload = {
                content: success
                    ? `🟢 **Antigravity Auto Wakeup Success**\nModel: \`${model}\`\nTokens: ${tokens}\nTime: ${new Date().toLocaleString()}`
                    : `🔴 **Antigravity Auto Wakeup Failed**\nError: ${error}\nTime: ${new Date().toLocaleString()}`
            };

            await fetch(this.config.notificationWebhook, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (e) {
            this.logger.error(`發送通知失敗: ${e}`);
        }
    }

    /**
     * 計算下次觸發時間
     */
    public calculateNextTriggerTime(): Date {
        const now = new Date();
        let triggerTime: Date;

        switch (this.config.mode) {
            case 'smart':
                triggerTime = this.calculateSmartTime(now);
                break;
            case 'fixed':
                triggerTime = this.calculateFixedTime(now);
                break;
            case 'cron':
                triggerTime = this.calculateCronTime(now);
                break;
            default:
                triggerTime = this.calculateSmartTime(now);
        }

        return triggerTime;
    }

    /**
     * 智能計算：工作時間 - 3 小時
     */
    /**
     * 智能計算：
     * 1. 預設：工作時間 - 3 小時
     * 2. 適應性：如果配額耗盡且已知重置時間，則安排在重置時間後 5 分鐘
     */
    private calculateSmartTime(now: Date): Date {
        // 1. 檢查是否有耗盡的模型 (Adaptive Strategy)
        const adaptiveTime = this.findEarliestResetTime(now);
        if (adaptiveTime) {
            this.logger.info(`[Smart Wakeup] 發現配額耗盡，調整喚醒時間至重置後: ${adaptiveTime.toLocaleString()}`);
            return adaptiveTime;
        }

        // 2. 標準策略 (Standard Strategy)
        const [hours, minutes] = this.config.workStartTime.split(':').map(Number);

        // 喚醒時間 = 工作時間 - 3 小時
        let wakeHours = hours - 3;
        if (wakeHours < 0) {
            wakeHours += 24;
        }

        const triggerTime = new Date(now);
        triggerTime.setHours(wakeHours, minutes, 0, 0);

        // 如果今天的時間已過，排到明天
        if (triggerTime <= now) {
            triggerTime.setDate(triggerTime.getDate() + 1);
        }

        return triggerTime;
    }

    /**
     * 尋找最早的重置時間 (針對已耗盡模型)
     */
    private findEarliestResetTime(now: Date): Date | null {
        try {
            const quotaData = this.quotaMonitor.getQuotaData();
            if (!quotaData || !quotaData.models) return null;

            let earliestReset: Date | null = null;

            // 定義耗盡閾值 (例如 < 20%)
            const EXHAUSTED_THRESHOLD = 20;

            for (const model of quotaData.models) {
                // 先只檢查被置頂或關鍵模型 (這裡簡化為檢查所有，或者可過濾 config.models)
                // 檢查是否耗盡
                if (model.percentage < EXHAUSTED_THRESHOLD && model.resetTime) {
                    const resetTime = new Date(model.resetTime);

                    // 只關心未來的重置時間
                    if (resetTime > now) {
                        if (!earliestReset || resetTime < earliestReset) {
                            earliestReset = resetTime;
                        }
                    }
                }
            }

            if (earliestReset) {
                // 緩衝 5 分鐘，確保伺服器端已重置
                return new Date(earliestReset.getTime() + 5 * 60 * 1000);
            }
        } catch (error) {
            this.logger.error(`計算適應性時間時發生錯誤: ${error}`);
        }
        return null;
    }

    /**
     * 固定時間計算
     */
    private calculateFixedTime(now: Date): Date {
        const times = this.config.fixedTimes.map(t => {
            const [hours, minutes] = t.split(':').map(Number);
            const time = new Date(now);
            time.setHours(hours, minutes, 0, 0);
            if (time <= now) {
                time.setDate(time.getDate() + 1);
            }
            return time;
        });

        // 返回最近的時間
        times.sort((a, b) => a.getTime() - b.getTime());
        return times[0] || this.calculateSmartTime(now);
    }

    /**
     * Cron 表達式計算（簡化版）
     */
    private calculateCronTime(now: Date): Date {
        // 簡化版：只解析 "分 時 * * *" 格式
        const parts = this.config.cronExpression.split(' ');
        if (parts.length >= 2) {
            const minutes = parseInt(parts[0]) || 0;
            const hours = parseInt(parts[1]) || 6;

            const triggerTime = new Date(now);
            triggerTime.setHours(hours, minutes, 0, 0);

            if (triggerTime <= now) {
                triggerTime.setDate(triggerTime.getDate() + 1);
            }

            return triggerTime;
        }

        return this.calculateSmartTime(now);
    }

    /**
     * 選擇最低消耗的模型
     */
    private selectModel(): string {
        const LOW_COST_ORDER = [
            'gemini-3-flash',
            'gemini-3-pro-low',
            'gpt-oss-120b',
            'gemini-3-pro-high'
        ];

        for (const model of LOW_COST_ORDER) {
            if (this.config.models.includes(model)) {
                return model;
            }
        }

        return this.config.models[0] || 'gemini-3-flash';
    }

    /**
     * 手動觸發測試
     */
    public async testNow(): Promise<boolean> {
        this.logger.info('手動執行 Auto Wake-up 測試...');
        await this.executeWakeup();
        return true;
    }

    /**
     * 取得歷史記錄
     */
    public getHistory(): WakeupHistoryEntry[] {
        return this.history.getAll();
    }

    /**
     * 取得設定
     */
    public getConfig(): WakeupConfig {
        return { ...this.config };
    }

    /**
     * 更新設定
     */
    public async updateConfig(config: Partial<WakeupConfig>): Promise<void> {
        const wasEnabled = this.config.enabled;
        this.config = { ...this.config, ...config };
        this.saveConfig();

        // 重新排程
        if (wasEnabled || this.config.enabled) {
            await this.stop();
            if (this.config.enabled) {
                await this.start();
            }
        }
    }

    /**
     * 載入設定
     */
    private loadConfig(): WakeupConfig {
        const saved = this.context.globalState.get<WakeupConfig>(CONFIG_KEY);
        return { ...DEFAULT_CONFIG, ...saved };
    }

    /**
     * 儲存設定
     */
    private saveConfig(): void {
        this.context.globalState.update(CONFIG_KEY, this.config);
    }

    /**
     * 釋放資源
     */
    public dispose(): void {
        this.stop();
        this.scheduler.dispose();
    }
}
