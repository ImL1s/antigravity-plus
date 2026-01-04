/**
 * 單元測試：Circuit Breaker
 * 
 * 可獨立運行，不依賴 VS Code
 */

import * as assert from 'assert';

// Mock Logger


// 複製 CircuitBreaker 核心邏輯
type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

class TestCircuitBreaker {
    private state: CircuitState = 'CLOSED';
    private failures = 0;
    private successes = 0;
    private lastFailureTime: Date | null = null;
    private config: { failureThreshold: number; resetTimeout: number; successThreshold: number };

    constructor(config: { failureThreshold: number; resetTimeout: number; successThreshold: number }) {
        this.config = config;
    }

    public canExecute(): boolean {
        if (this.state === 'CLOSED') return true;
        if (this.state === 'OPEN') {
            if (this.lastFailureTime) {
                const elapsed = Date.now() - this.lastFailureTime.getTime();
                if (elapsed >= this.config.resetTimeout) {
                    this.state = 'HALF_OPEN';
                    return true;
                }
            }
            return false;
        }
        return true; // HALF_OPEN
    }

    public recordSuccess(): void {
        this.failures = 0;
        if (this.state === 'HALF_OPEN') {
            this.successes++;
            if (this.successes >= this.config.successThreshold) {
                this.state = 'CLOSED';
            }
        }
    }

    public recordFailure(): void {
        this.failures++;
        this.lastFailureTime = new Date();
        this.successes = 0;
        if (this.state === 'HALF_OPEN') {
            this.state = 'OPEN';
        } else if (this.failures >= this.config.failureThreshold) {
            this.state = 'OPEN';
        }
    }

    public getState(): CircuitState {
        return this.state;
    }

    public getStats() {
        return { state: this.state, failures: this.failures, successes: this.successes };
    }

    public reset(): void {
        this.state = 'CLOSED';
        this.failures = 0;
        this.successes = 0;
        this.lastFailureTime = null;
    }
}

describe('CircuitBreaker Unit Tests', () => {
    let circuitBreaker: TestCircuitBreaker;

    beforeEach(() => {
        circuitBreaker = new TestCircuitBreaker({
            failureThreshold: 3,
            resetTimeout: 100, // 100ms for faster tests
            successThreshold: 2
        });
    });

    describe('初始狀態', () => {
        it('初始狀態應該是 CLOSED', () => {
            assert.strictEqual(circuitBreaker.getState(), 'CLOSED');
        });

        it('初始時應該可以執行', () => {
            assert.strictEqual(circuitBreaker.canExecute(), true);
        });
    });

    describe('失敗處理', () => {
        it('單次失敗不應該開啟斷路器', () => {
            circuitBreaker.recordFailure();
            assert.strictEqual(circuitBreaker.getState(), 'CLOSED');
            assert.strictEqual(circuitBreaker.canExecute(), true);
        });

        it('達到失敗閾值應該開啟斷路器', () => {
            circuitBreaker.recordFailure();
            circuitBreaker.recordFailure();
            circuitBreaker.recordFailure();
            assert.strictEqual(circuitBreaker.getState(), 'OPEN');
            assert.strictEqual(circuitBreaker.canExecute(), false);
        });
    });

    describe('成功處理', () => {
        it('成功應該重置失敗計數', () => {
            circuitBreaker.recordFailure();
            circuitBreaker.recordFailure();
            circuitBreaker.recordSuccess();

            const stats = circuitBreaker.getStats();
            assert.strictEqual(stats.failures, 0);
        });
    });

    describe('狀態轉換', () => {
        it('OPEN 狀態超時後應該轉換到 HALF_OPEN', async () => {
            circuitBreaker.recordFailure();
            circuitBreaker.recordFailure();
            circuitBreaker.recordFailure();
            assert.strictEqual(circuitBreaker.getState(), 'OPEN');

            await new Promise(resolve => setTimeout(resolve, 150));

            assert.strictEqual(circuitBreaker.canExecute(), true);
            assert.strictEqual(circuitBreaker.getState(), 'HALF_OPEN');
        });

        it('HALF_OPEN 狀態成功後應該轉換到 CLOSED', async () => {
            circuitBreaker.recordFailure();
            circuitBreaker.recordFailure();
            circuitBreaker.recordFailure();

            await new Promise(resolve => setTimeout(resolve, 150));
            circuitBreaker.canExecute();

            circuitBreaker.recordSuccess();
            circuitBreaker.recordSuccess();
            assert.strictEqual(circuitBreaker.getState(), 'CLOSED');
        });

        it('HALF_OPEN 狀態失敗後應該回到 OPEN', async () => {
            circuitBreaker.recordFailure();
            circuitBreaker.recordFailure();
            circuitBreaker.recordFailure();

            await new Promise(resolve => setTimeout(resolve, 150));
            circuitBreaker.canExecute();

            circuitBreaker.recordFailure();
            assert.strictEqual(circuitBreaker.getState(), 'OPEN');
        });
    });

    describe('重置', () => {
        it('reset() 應該重置所有狀態', () => {
            circuitBreaker.recordFailure();
            circuitBreaker.recordFailure();
            circuitBreaker.recordFailure();
            assert.strictEqual(circuitBreaker.getState(), 'OPEN');

            circuitBreaker.reset();
            assert.strictEqual(circuitBreaker.getState(), 'CLOSED');
            assert.strictEqual(circuitBreaker.canExecute(), true);
        });
    });
});
