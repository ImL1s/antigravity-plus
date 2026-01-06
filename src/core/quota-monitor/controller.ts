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

export interface ModelQuota {
    name: string;
    displayName: string;
    used: number;
    total: number;
    percentage: number;
    resetTime?: Date;
    // 新增欄位 (對標 Cockpit)
    remainingFraction?: number;
    remainingPercentage?: number;
    isExhausted?: boolean;
    timeUntilReset?: number;
    timeUntilResetFormatted?: string;
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
    // ✅ 新增欄位
    userInfo?: {
        name: string;
        email: string;
        tier: string;
    };
}

export class QuotaMonitorController implements vscode.Disposable {
    private enabled: boolean = true;
    private pollingInterval: number = 60;
    private pollingTimer: NodeJS.Timeout | undefined;
    private usageProvider: AntigravityUsageProvider;
    private currentSession: UsageSession;
    private quotaData: QuotaData | undefined;
    private disposables: vscode.Disposable[] = [];
    private quotaUpdateCallback: ((data: QuotaData) => void) | undefined;

    constructor(
        private context: vscode.ExtensionContext,
        private logger: Logger,
        private configManager: ConfigManager,
        private statusBarManager: StatusBarManager
    ) {
        this.enabled = configManager.get<boolean>('quotaMonitor.enabled') ?? true;
        this.pollingInterval = configManager.get<number>('quotaMonitor.pollingInterval') ?? 60;

        this.usageProvider = new AntigravityUsageProvider(logger);

        // 初始化 Session
        this.currentSession = this.createNewSession();

        this.logger.info('QuotaMonitorController 初始化完成');
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
        await this.refresh();

        // 設定定時輪詢
        this.startPolling();
    }

    /**
     * 開始定時輪詢
     */
    private startPolling(): void {
        if (this.pollingTimer) {
            clearInterval(this.pollingTimer);
        }

        this.pollingTimer = setInterval(async () => {
            await this.refresh();
        }, this.pollingInterval * 1000);
    }

    /**
     * 刷新配額資料
     */
    public async refresh(): Promise<void> {
        try {
            this.logger.debug('正在刷新配額...');

            const data = await this.usageProvider.fetchQuota();

            if (data) {
                this.quotaData = data;
                this.statusBarManager.updateQuota(data);
                // 推送更新到 Dashboard (如果有訂閱)
                if (this.quotaUpdateCallback) {
                    this.quotaUpdateCallback(data);
                }
                this.logger.debug('配額已更新');
            }
        } catch (error) {
            this.logger.error(`刷新配額失敗: ${error}`);
        }
    }

    /**
     * 取得目前配額資料
     */
    public getQuotaData(): QuotaData | undefined {
        return this.quotaData;
    }

    /**
     * 訂閱配額更新事件
     * 用於 Dashboard 等 UI 元件接收即時更新
     */
    public onQuotaUpdate(callback: (data: QuotaData) => void): void {
        this.quotaUpdateCallback = callback;
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
            this.startPolling();
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
