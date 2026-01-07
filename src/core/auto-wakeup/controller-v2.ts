/**
 * Auto Wake-up Controller - 重構版
 * 
 * 對齊 antigravity-cockpit 的 auto_trigger/controller.ts
 * 整合 OAuth、排程器、觸發器，提供統一的介面
 */

import * as vscode from 'vscode';
import { Logger } from '../../utils/logger';
import { credentialStorage } from './credential-storage';
import { OAuthService, createOAuthService } from './oauth-service';
import { TriggerService, createTriggerService } from './trigger-service';
import { SchedulerService, createSchedulerService } from './scheduler-service';
import {
    ScheduleConfig,
    AutoTriggerState,
    AutoTriggerMessage,
    TriggerRecord,
    ModelInfo,
    SCHEDULE_PRESETS,
    DEFAULT_SCHEDULE_CONFIG,
} from './types';
import { QuotaMonitorController } from '../quota-monitor/controller';

const SCHEDULE_CONFIG_KEY = 'antigravity-plus.scheduleConfig';

/**
 * Auto Wake-up Controller
 * 自動喚醒主控制器
 */
export class AutoWakeupControllerV2 implements vscode.Disposable {
    private initialized = false;
    private messageHandler?: (message: AutoTriggerMessage) => void;
    private quotaModelConstants: string[] = [];

    private oauthService: OAuthService;
    private triggerService: TriggerService;
    private schedulerService: SchedulerService;
    private config: ScheduleConfig = { ...DEFAULT_SCHEDULE_CONFIG };

    constructor(
        private context: vscode.ExtensionContext,
        private logger: Logger,
        private quotaMonitor?: QuotaMonitorController,
        private statusBarManager?: any
    ) {
        this.oauthService = createOAuthService(logger);
        this.triggerService = createTriggerService(logger, this.oauthService);
        this.schedulerService = createSchedulerService(logger);

        // 設定排程觸發回調
        this.schedulerService.onTrigger(() => this.executeTrigger());
    }

    /**
     * 設定配額模型常數列表
     */
    setQuotaModels(modelConstants: string[]): void {
        this.quotaModelConstants = modelConstants;
        this.logger.debug(`[AutoWakeupControllerV2] Set quota models: ${modelConstants.join(', ')}`);
    }

    /**
     * 初始化控制器
     */
    async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        // 初始化憑證儲存
        credentialStorage.initialize(this.context);

        // 初始化觸發服務
        this.triggerService.initialize();

        // 載入排程配置
        this.loadScheduleConfig();

        // 啟動排程器
        if (this.config.enabled) {
            this.schedulerService.setConfig(this.config);
        }

        this.initialized = true;
        this.logger.info('[AutoWakeupControllerV2] Initialized');
    }

    /**
     * 載入排程配置
     */
    private loadScheduleConfig(): void {
        const saved = this.context.globalState.get<ScheduleConfig>(SCHEDULE_CONFIG_KEY);
        if (saved) {
            this.config = { ...DEFAULT_SCHEDULE_CONFIG, ...saved };
        }
    }

    /**
     * 儲存排程配置
     */
    private async saveScheduleConfig(): Promise<void> {
        await this.context.globalState.update(SCHEDULE_CONFIG_KEY, this.config);
    }

    /**
     * 獲取當前狀態
     */
    async getState(): Promise<AutoTriggerState> {
        const authStatus = await this.oauthService.getAuthorizationStatus();
        const recentTriggers = this.triggerService.getRecentTriggers();
        const lastTrigger = this.triggerService.getLastTrigger();
        const nextTriggerTime = this.schedulerService.getScheduledTime()?.toISOString();
        const availableModels = await this.triggerService.fetchAvailableModels(this.quotaModelConstants);

        return {
            authorization: authStatus,
            schedule: this.config,
            lastTrigger,
            recentTriggers: recentTriggers.slice(0, 10),
            nextTriggerTime,
            availableModels,
        };
    }

    /**
     * 開始授權流程
     */
    async startAuthorization(): Promise<boolean> {
        const result = await this.oauthService.startAuthorization();
        if (result) {
            await this.notifyStateUpdate();
        }
        return result;
    }

    /**
     * 撤銷授權
     */
    async revokeAuthorization(): Promise<void> {
        await this.oauthService.revokeAuthorization();
        this.schedulerService.cancel();
        await this.notifyStateUpdate();
    }

    /**
     * 儲存排程配置
     */
    async saveSchedule(config: Partial<ScheduleConfig>): Promise<void> {
        this.config = { ...this.config, ...config };
        await this.saveScheduleConfig();

        // 更新排程器
        this.schedulerService.setConfig(this.config);

        this.logger.info(`[AutoWakeupControllerV2] Schedule saved: ${this.schedulerService.describeSchedule()}`);
        await this.notifyStateUpdate();
    }

    /**
     * 手動觸發一次
     */
    async testTrigger(models?: string[], customPrompt?: string): Promise<TriggerRecord> {
        const targetModels = models && models.length > 0
            ? models
            : this.config.selectedModels;

        const record = await this.triggerService.trigger(
            targetModels,
            'manual',
            customPrompt || this.config.customPrompt,
            'manual'
        );

        await this.notifyStateUpdate();
        return record;
    }

    /**
     * 執行觸發（由排程器調用）
     */
    private async executeTrigger(): Promise<void> {
        this.logger.info('[AutoWakeupControllerV2] Executing scheduled trigger...');

        await this.triggerService.trigger(
            this.config.selectedModels,
            'auto',
            this.config.customPrompt,
            'scheduled'
        );

        await this.notifyStateUpdate();

        // 更新狀態列
        if (this.statusBarManager) {
            const nextTime = this.schedulerService.getScheduledTime();
            if (nextTime && this.statusBarManager.updateBackgroundState) {
                this.statusBarManager.updateBackgroundState(true, nextTime);
            }
        }
    }

    /**
     * 檢查配額重置並自動觸發喚醒
     * 由 QuotaMonitorController 在配額刷新後調用
     */
    async checkAndTriggerOnQuotaReset(
        models: Array<{ id: string; resetAt?: string; remaining: number; limit: number }>
    ): Promise<void> {
        if (!this.config.wakeOnReset) {
            return;
        }

        const modelsToTrigger: string[] = [];

        for (const model of models) {
            if (!model.resetAt) {
                continue;
            }

            if (this.triggerService.shouldTriggerOnReset(
                model.id,
                model.resetAt,
                model.remaining,
                model.limit
            )) {
                modelsToTrigger.push(model.id);
                this.triggerService.markResetTriggered(model.id, model.resetAt);
            }
        }

        if (modelsToTrigger.length > 0) {
            this.logger.info(`[AutoWakeupControllerV2] Triggering on quota reset for: ${modelsToTrigger.join(', ')}`);

            await this.triggerService.trigger(
                modelsToTrigger,
                'auto',
                this.config.customPrompt,
                'quota_reset'
            );

            await this.notifyStateUpdate();

            vscode.window.showInformationMessage(
                `Auto Wake-up: 已觸發配額重置喚醒 (${modelsToTrigger.join(', ')})`
            );
        }
    }

    /**
     * 清空歷史記錄
     */
    async clearHistory(): Promise<void> {
        this.triggerService.clearHistory();
        await this.notifyStateUpdate();
    }

    /**
     * 獲取預設模板
     */
    getPresets(): typeof SCHEDULE_PRESETS {
        return SCHEDULE_PRESETS;
    }

    /**
     * 獲取下次運行時間格式化字串
     */
    getNextRunTimeFormatted(): string | null {
        return this.schedulerService.getNextRunTimeFormatted();
    }

    /**
     * 獲取排程描述
     */
    describeSchedule(): string {
        return this.schedulerService.describeSchedule();
    }

    // ============================================
    // 向後相容方法 (Legacy API)
    // ============================================

    /**
     * 測試觸發 (向後相容 testNow)
     */
    async testNow(): Promise<boolean> {
        const record = await this.testTrigger();
        return record.success;
    }

    /**
     * 取得配置 (向後相容 getConfig)
     * 返回兼容舊版的 WakeupConfig 格式
     */
    getConfig(): { enabled: boolean; mode: string; workStartTime: string; models: string[] } {
        return {
            enabled: this.config.enabled,
            mode: this.config.repeatMode,
            workStartTime: this.config.dailyTimes?.[0] || '07:00',
            models: this.config.selectedModels,
        };
    }

    /**
     * 更新配置 (向後相容 updateConfig)
     */
    async updateConfig(config: Partial<{ enabled: boolean; mode: string; models: string[] }>): Promise<void> {
        const updates: Partial<ScheduleConfig> = {};

        if (config.enabled !== undefined) {
            updates.enabled = config.enabled;
        }
        if (config.mode !== undefined) {
            updates.repeatMode = config.mode as ScheduleConfig['repeatMode'];
        }
        if (config.models !== undefined) {
            updates.selectedModels = config.models;
        }

        await this.saveSchedule(updates);
    }

    /**
     * 獲取歷史記錄 (向後相容 getHistory)
     */
    getHistory(): TriggerRecord[] {
        return this.triggerService.getRecentTriggers();
    }

    /**
     * 處理來自 Webview 的訊息
     */
    async handleMessage(message: AutoTriggerMessage): Promise<void> {
        switch (message.type) {
            case 'auto_trigger_get_state':
                await this.notifyStateUpdate();
                break;

            case 'auto_trigger_start_auth':
                await this.startAuthorization();
                break;

            case 'auto_trigger_revoke_auth':
                await this.revokeAuthorization();
                break;

            case 'auto_trigger_save_schedule':
                if (message.data?.schedule) {
                    await this.saveSchedule(message.data.schedule as Partial<ScheduleConfig>);
                }
                break;

            case 'auto_trigger_test_trigger':
                await this.testTrigger(message.data?.models as string[]);
                break;

            case 'auto_trigger_clear_history':
                await this.clearHistory();
                break;
        }
    }

    /**
     * 設定訊息處理器（用於向 Webview 發送更新）
     */
    setMessageHandler(handler: (message: AutoTriggerMessage) => void): void {
        this.messageHandler = handler;
    }

    /**
     * 通知狀態更新
     */
    async notifyStateUpdate(): Promise<void> {
        if (!this.messageHandler) {
            return;
        }

        const state = await this.getState();
        this.messageHandler({
            type: 'auto_trigger_state_update',
            data: state as unknown as { [key: string]: unknown },
        });
    }

    /**
     * 獲取可用模型列表
     */
    async fetchAvailableModels(): Promise<ModelInfo[]> {
        return this.triggerService.fetchAvailableModels(this.quotaModelConstants);
    }

    /**
     * 釋放資源
     */
    dispose(): void {
        this.schedulerService.dispose();
        this.messageHandler = undefined;
        this.logger.info('[AutoWakeupControllerV2] Disposed');
    }
}

/**
 * 建立 AutoWakeupControllerV2 實例
 */
export function createAutoWakeupController(
    context: vscode.ExtensionContext,
    logger: Logger,
    quotaMonitor?: QuotaMonitorController,
    statusBarManager?: any
): AutoWakeupControllerV2 {
    return new AutoWakeupControllerV2(context, logger, quotaMonitor, statusBarManager);
}
