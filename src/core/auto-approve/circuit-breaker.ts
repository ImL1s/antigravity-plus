/**
 * Circuit Breaker（斷路器）
 * 
 * 參考 Yoke AntiGravity 的安全機制
 * 
 * 防止自動核准進入無限迴圈或錯誤狀態
 * 
 * 狀態：
 * - CLOSED: 正常運作
 * - OPEN: 錯誤過多，暫停執行
 * - HALF_OPEN: 嘗試恢復
 */

import { Logger } from '../../utils/logger';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
    failureThreshold: number;      // 觸發開啟的失敗次數
    resetTimeout: number;          // 從 OPEN 到 HALF_OPEN 的等待時間 (ms)
    successThreshold: number;      // 從 HALF_OPEN 到 CLOSED 需要的成功次數
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
    failureThreshold: 5,
    resetTimeout: 30000,      // 30 秒
    successThreshold: 3
};

export class CircuitBreaker {
    private state: CircuitState = 'CLOSED';
    private failures = 0;
    private successes = 0;
    private lastFailureTime: Date | null = null;
    private config: CircuitBreakerConfig;

    // 事件回調
    private onStateChange?: (state: CircuitState) => void;

    constructor(
        private logger: Logger,
        config?: Partial<CircuitBreakerConfig>
    ) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * 檢查是否可以執行
     */
    public canExecute(): boolean {
        switch (this.state) {
            case 'CLOSED':
                return true;

            case 'OPEN':
                // 檢查是否已過重置時間
                if (this.lastFailureTime) {
                    const elapsed = Date.now() - this.lastFailureTime.getTime();
                    if (elapsed >= this.config.resetTimeout) {
                        this.transitionTo('HALF_OPEN');
                        return true;
                    }
                }
                return false;

            case 'HALF_OPEN':
                return true;

            default:
                return false;
        }
    }

    /**
     * 記錄成功
     */
    public recordSuccess(): void {
        this.failures = 0;

        if (this.state === 'HALF_OPEN') {
            this.successes++;
            if (this.successes >= this.config.successThreshold) {
                this.transitionTo('CLOSED');
            }
        }
    }

    /**
     * 記錄失敗
     */
    public recordFailure(): void {
        this.failures++;
        this.lastFailureTime = new Date();
        this.successes = 0;

        if (this.state === 'HALF_OPEN') {
            // 在 HALF_OPEN 狀態失敗，立即回到 OPEN
            this.transitionTo('OPEN');
        } else if (this.failures >= this.config.failureThreshold) {
            // 失敗次數達到閾值，開啟斷路器
            this.transitionTo('OPEN');
        }
    }

    /**
     * 狀態轉換
     */
    private transitionTo(newState: CircuitState): void {
        const oldState = this.state;
        this.state = newState;

        if (newState === 'CLOSED') {
            this.failures = 0;
            this.successes = 0;
        }

        this.logger.info(`Circuit Breaker: ${oldState} → ${newState}`);

        if (this.onStateChange) {
            this.onStateChange(newState);
        }
    }

    /**
     * 取得當前狀態
     */
    public getState(): CircuitState {
        return this.state;
    }

    /**
     * 取得統計資料
     */
    public getStats(): {
        state: CircuitState;
        failures: number;
        successes: number;
        lastFailureTime: Date | null;
        timeUntilReset: number | null;
    } {
        let timeUntilReset = null;

        if (this.state === 'OPEN' && this.lastFailureTime) {
            const elapsed = Date.now() - this.lastFailureTime.getTime();
            timeUntilReset = Math.max(0, this.config.resetTimeout - elapsed);
        }

        return {
            state: this.state,
            failures: this.failures,
            successes: this.successes,
            lastFailureTime: this.lastFailureTime,
            timeUntilReset
        };
    }

    /**
     * 強制重置
     */
    public reset(): void {
        this.transitionTo('CLOSED');
        this.failures = 0;
        this.successes = 0;
        this.lastFailureTime = null;
        this.logger.info('Circuit Breaker 已重置');
    }

    /**
     * 設定狀態變更回調
     */
    public setOnStateChange(callback: (state: CircuitState) => void): void {
        this.onStateChange = callback;
    }

    /**
     * 更新設定
     */
    public updateConfig(config: Partial<CircuitBreakerConfig>): void {
        this.config = { ...this.config, ...config };
    }
}
