/**
 * 配額監控控制器
 * 
 * 參考 AntigravityQuotaWatcher 和 AntigravityQuota 的實作
 * 
 * 工作原理：
 * 1. 進程檢測 - 掃描 Antigravity 的 language server 進程
 * 2. 端口發現 - 測試監聽端口找到正確的 API 端點
 * 3. 配額抓取 - 呼叫 GetUserStatus API 獲取模型配額
 * 4. UI 更新 - 解析回應並更新狀態列
 */

import * as vscode from 'vscode';
import { Logger } from '../../utils/logger';
import { ConfigManager } from '../../utils/config';
import { StatusBarManager } from '../../ui/status-bar';
import { AntigravityUsageProvider } from '../../providers/antigravity-usage';
import { GroupingManager } from './grouping';

/**
 * 模型配額資訊介面 (對標 Cockpit ModelQuotaInfo)
 */
export interface ModelQuota {
    // 基本欄位
    name: string;           // modelId
    displayName: string;    // label
    used: number;           // 已使用百分比
    total: number;          // 總量 (固定 100)
    percentage: number;     // 已使用百分比
    resetTime?: Date;

    // ✅ 新增欄位 (對標 Cockpit)
    remainingFraction?: number;         // 剩餘比例 (0-1)
    remainingPercentage?: number;       // 剩餘百分比 (0-100)
    isExhausted?: boolean;              // 是否已耗盡
    timeUntilReset?: number;            // 距離重置毫秒數
    timeUntilResetFormatted?: string;   // 格式化倒計時

    // 能力欄位
    supportsImages?: boolean;
    isRecommended?: boolean;
    tagTitle?: string;
}

export interface UsageSession {
    id: string;
    startTime: Date;
    inputTokens: number;
    outputTokens: number;
    estimatedCost: number;
    model: string;
}

/**
 * 使用者資訊介面
 */
export interface UserInfo {
    name: string;
    email: string;
    tier: string;
}

/**
 * 配額快照資料介面 (對標 Cockpit QuotaSnapshot)
 */
export interface QuotaData {
    models: ModelQuota[];
    accountLevel: string;
    promptCredits?: {
        used: number;
        total: number;
        usedPercentage?: number;
        remainingPercentage?: number;
    };
    lastUpdated: Date;
    userInfo?: UserInfo;  // ✅ 新增使用者資訊
}

export class QuotaMonitorController implements vscode.Disposable {
    private enabled: boolean = true;
    private pollingInterval: number = 60;
    private pollingTimer: NodeJS.Timeout | undefined;
    private usageProvider: AntigravityUsageProvider;
    private groupingManager: GroupingManager;
    private currentSession: UsageSession;
    private quotaData: QuotaData | undefined;

    private _onDidUpdateQuota = new vscode.EventEmitter<QuotaData>();
    public readonly onDidUpdateQuota = this._onDidUpdateQuota.event;

    private disposables: vscode.Disposable[] = [];

    constructor(
        private context: vscode.ExtensionContext,
        private logger: Logger,
        private configManager: ConfigManager,
        private statusBarManager: StatusBarManager
    ) {
        this.enabled = configManager.get<boolean>('quotaMonitor.enabled') ?? true;
        this.pollingInterval = configManager.get<number>('quotaMonitor.pollingInterval') ?? 60;

        this.usageProvider = new AntigravityUsageProvider(logger);
        this.groupingManager = new GroupingManager(context);

        // 初始化 Session
        this.currentSession = this.createNewSession();

        // 嘗試載入快取 (模仿 Cockpit 秒開體驗)
        this.loadCachedQuota();

        this.logger.info('QuotaMonitorController 初始化完成');
    }

    /**
     * 載入快取的配額資料
     */
    private loadCachedQuota(): void {
        const cached = this.context.globalState.get<QuotaData>('antigravity-plus.quotaCache');
        if (cached) {
            this.logger.info('已載入配額快取，立即顯示');
            // 恢復 Date 物件 (JSON 序列化後會變字串)
            this.restoreDates(cached);
            this.quotaData = cached;
            this.statusBarManager.updateQuota(cached);
            this._onDidUpdateQuota.fire(cached);
        }
    }

    /**
     * 恢復 JSON 反序列化後的 Date 物件
     */
    private restoreDates(data: QuotaData): void {
        if (data.lastUpdated) data.lastUpdated = new Date(data.lastUpdated);
        if (data.models) {
            data.models.forEach(m => {
                if (m.resetTime) m.resetTime = new Date(m.resetTime);
            });
        }
    }

    /**
     * 建立新的 Session
     */
    private createNewSession(): UsageSession {
        return {
            id: Date.now().toString(),
            startTime: new Date(),
            inputTokens: 0,
            outputTokens: 0,
            estimatedCost: 0,
            model: 'gemini-3-pro'
        };
    }

    /**
     * 啟動監控
     */
    public async start(): Promise<void> {
        if (!this.enabled) {
            this.logger.info('配額監控已停用');
            return;
        }

        this.logger.info('開始配額監控...');

        // 立即執行一次
        const success = await this.refresh();

        if (success) {
            // 如果成功，進入正常輪詢
            this.startPolling(this.pollingInterval * 1000);
        } else {
            // 如果失敗，進入熱身模式（快速重試）
            this.logger.info('首次連接失敗，進入熱身模式 (5s polling)');
            this.startPolling(5000); // 每 5 秒重試
        }
    }

    /**
     * 開始定時輪詢
     */
    private startPolling(intervalMs: number): void {
        if (this.pollingTimer) {
            clearInterval(this.pollingTimer);
        }

        let attempts = 0;
        const WARMUP_LIMIT = 24; // 2 minutes max for warm-up (5s * 24)

        this.pollingTimer = setInterval(async () => {
            const success = await this.refresh();

            // 如果在熱身模式下成功了，切換回正常頻率
            if (intervalMs === 5000 && success) {
                this.logger.info('連接成功，切換回正常輪詢 (60s)');
                this.startPolling(this.pollingInterval * 1000);
            }
            // 如果熱身模式超時仍未成功，也切換回正常頻率
            else if (intervalMs === 5000 && !success) {
                attempts++;
                if (attempts >= WARMUP_LIMIT) {
                    this.logger.warn('熱身模式超時，切換回正常輪詢 (60s)');
                    this.startPolling(this.pollingInterval * 1000);
                }
            }
        }, intervalMs);
    }

    /**
     * 刷新配額資料
     */
    public async refresh(): Promise<boolean> {
        try {
            this.logger.debug('正在刷新配額...');

            const data = await this.usageProvider.fetchQuota();

            if (data) {
                this.quotaData = data;
                this.quotaData = data;

                // 計算分組
                const groups = this.groupingManager.createGroups(data.models);

                this.statusBarManager.updateQuota(data);
                this.statusBarManager.updateGroups(groups);

                // 更新快取
                void this.context.globalState.update('antigravity-plus.quotaCache', data);

                this.logger.debug('配額已更新並快取');
                return true;
            } else {
                // 如果是 undefined，表示獲取失敗
                if (!this.quotaData) {
                    // 若從未獲取過數據，顯示 Offline
                    this.statusBarManager.setOffline();
                }
                return false;
            }
        } catch (error) {
            this.logger.error(`刷新配額失敗: ${error}`);
            this.statusBarManager.setError('Connection Error');
            return false;
        }
    }

    /**
     * 取得目前配額資料
     */
    public getQuotaData(): QuotaData | undefined {
        return this.quotaData;
    }

    /**
     * 取得目前 Session
     */
    public getSession(): UsageSession {
        return { ...this.currentSession };
    }

    /**
     * 重置 Session
     */
    public resetSession(): void {
        this.currentSession = this.createNewSession();
        this.statusBarManager.updateSession(this.currentSession);
        this.logger.info('Session 已重置');
    }

    /**
     * 記錄 Token 使用量
     */
    public trackUsage(inputTokens: number, outputTokens: number, model: string): void {
        this.currentSession.inputTokens += inputTokens;
        this.currentSession.outputTokens += outputTokens;
        this.currentSession.model = model;

        // 計算成本估算
        this.currentSession.estimatedCost = this.calculateCost(
            this.currentSession.inputTokens,
            this.currentSession.outputTokens,
            model
        );

        this.statusBarManager.updateSession(this.currentSession);
    }

    /**
     * 計算成本
     */
    private calculateCost(inputTokens: number, outputTokens: number, model: string): number {
        // 模型定價表（每百萬 Token）
        const pricing: Record<string, { input: number; output: number }> = {
            'gemini-3-pro': { input: 1.25, output: 5.0 },
            'gemini-3-pro-high': { input: 1.25, output: 5.0 },
            'gemini-3-flash': { input: 0.075, output: 0.30 },
            'claude-sonnet-4.5': { input: 3.0, output: 15.0 },
            'claude-opus-4.5': { input: 15.0, output: 75.0 },
            'gpt-4o': { input: 5.0, output: 15.0 },
            'gpt-4o-mini': { input: 0.15, output: 0.60 },
        };

        const modelPricing = pricing[model] || pricing['gemini-3-pro'];

        const inputCost = (inputTokens / 1_000_000) * modelPricing.input;
        const outputCost = (outputTokens / 1_000_000) * modelPricing.output;

        return inputCost + outputCost;
    }

    /**
     * 更新設定
     */
    public updateConfig(): void {
        this.enabled = this.configManager.get<boolean>('quotaMonitor.enabled') ?? true;
        this.pollingInterval = this.configManager.get<number>('quotaMonitor.pollingInterval') ?? 60;

        if (this.enabled) {
            this.startPolling(this.pollingInterval * 1000);
        } else {
            if (this.pollingTimer) {
                clearInterval(this.pollingTimer);
                this.pollingTimer = undefined;
            }
        }

        this.logger.info('QuotaMonitorController 設定已更新');
    }

    /**
     * 釋放資源
     */
    public dispose(): void {
        if (this.pollingTimer) {
            clearInterval(this.pollingTimer);
        }
        this.disposables.forEach(d => d.dispose());
        this.logger.info('QuotaMonitorController 已釋放');
    }
}
