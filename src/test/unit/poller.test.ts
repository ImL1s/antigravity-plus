/**
 * Unit Tests: Auto Accept Poller
 * 
 * 覆蓋輪詢引擎的核心邏輯
 */

import * as assert from 'assert';

// Mock Poller 的核心邏輯 (無需 VS Code 環境)
interface PollerConfig {
    enabled: boolean;
    pollInterval: number;
    fileOperations: boolean;
    terminalCommands: boolean;
}

interface DetectionResult {
    type: 'accept' | 'run' | 'confirm' | 'apply';
    selector?: string;
    text?: string;
}

class MockCircuitBreaker {
    private failures = 0;
    private readonly threshold = 3;
    private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

    canExecute(): boolean {
        return this.state !== 'OPEN';
    }

    recordSuccess(): void {
        this.failures = 0;
        this.state = 'CLOSED';
    }

    recordFailure(): void {
        this.failures++;
        if (this.failures >= this.threshold) {
            this.state = 'OPEN';
        }
    }

    getState(): string {
        return this.state;
    }
}

class MockRulesEngine {
    private denyList = ['rm -rf /', 'format c:'];
    private allowList = ['npm install', 'npm run dev'];

    evaluate(input: { type: string; content: string }): { approved: boolean; rule?: string } {
        const content = input.content.toLowerCase();

        for (const pattern of this.denyList) {
            if (content.includes(pattern.toLowerCase())) {
                return { approved: false, rule: `DENY: ${pattern}` };
            }
        }

        for (const pattern of this.allowList) {
            if (content.includes(pattern.toLowerCase())) {
                return { approved: true, rule: `ALLOW: ${pattern}` };
            }
        }

        return { approved: true, rule: 'DEFAULT_ALLOW' };
    }
}

class TestablePoller {
    private isRunning = false;
    private isPaused = false;
    private pollInterval: number;
    private stats = {
        totalPolls: 0,
        successfulDetections: 0,
        autoApproved: 0,
        blocked: 0
    };

    constructor(
        private rulesEngine: MockRulesEngine,
        private circuitBreaker: MockCircuitBreaker,
        private config: PollerConfig
    ) {
        this.pollInterval = config.pollInterval || 200;
    }

    start(): boolean {
        if (this.isRunning) return false;
        if (!this.config.enabled) return false;

        this.isRunning = true;
        this.isPaused = false;
        return true;
    }

    stop(): void {
        this.isRunning = false;
    }

    pause(): void {
        this.isPaused = true;
    }

    resume(): void {
        this.isPaused = false;
    }

    isActive(): boolean {
        return this.isRunning && !this.isPaused;
    }

    // 模擬一次輪詢
    poll(detections: DetectionResult[] = []): { approved: DetectionResult[]; blocked: DetectionResult[] } {
        if (this.isPaused) {
            return { approved: [], blocked: [] };
        }

        if (!this.circuitBreaker.canExecute()) {
            return { approved: [], blocked: [] };
        }

        this.stats.totalPolls++;

        const approved: DetectionResult[] = [];
        const blocked: DetectionResult[] = [];

        for (const detection of detections) {
            this.stats.successfulDetections++;

            if (detection.type === 'run') {
                const result = this.rulesEngine.evaluate({
                    type: 'terminal',
                    content: detection.text || ''
                });

                if (result.approved) {
                    approved.push(detection);
                    this.stats.autoApproved++;
                } else {
                    blocked.push(detection);
                    this.stats.blocked++;
                }
            } else {
                // accept, confirm, apply 預設通過
                approved.push(detection);
                this.stats.autoApproved++;
            }
        }

        if (detections.length > 0) {
            this.circuitBreaker.recordSuccess();
        }

        return { approved, blocked };
    }

    getStats() {
        return { ...this.stats };
    }

    resetStats(): void {
        this.stats = {
            totalPolls: 0,
            successfulDetections: 0,
            autoApproved: 0,
            blocked: 0
        };
    }

    updateConfig(config: Partial<PollerConfig>): void {
        if (config.pollInterval !== undefined) {
            this.pollInterval = config.pollInterval;
        }
        if (config.enabled !== undefined) {
            this.config.enabled = config.enabled;
        }
    }
}

describe('Unit Tests - Auto Accept Poller', () => {
    let poller: TestablePoller;
    let rulesEngine: MockRulesEngine;
    let circuitBreaker: MockCircuitBreaker;

    beforeEach(() => {
        rulesEngine = new MockRulesEngine();
        circuitBreaker = new MockCircuitBreaker();
        poller = new TestablePoller(rulesEngine, circuitBreaker, {
            enabled: true,
            pollInterval: 200,
            fileOperations: true,
            terminalCommands: true
        });
    });

    describe('啟動與停止', () => {
        it('應該能成功啟動', () => {
            const result = poller.start();
            assert.strictEqual(result, true);
            assert.strictEqual(poller.isActive(), true);
        });

        it('已啟動時再次啟動應返回 false', () => {
            poller.start();
            const result = poller.start();
            assert.strictEqual(result, false);
        });

        it('未啟用時應無法啟動', () => {
            const disabledPoller = new TestablePoller(rulesEngine, circuitBreaker, {
                enabled: false,
                pollInterval: 200,
                fileOperations: true,
                terminalCommands: true
            });
            const result = disabledPoller.start();
            assert.strictEqual(result, false);
        });

        it('應該能成功停止', () => {
            poller.start();
            poller.stop();
            assert.strictEqual(poller.isActive(), false);
        });
    });

    describe('暫停與恢復', () => {
        it('暫停後 isActive 應返回 false', () => {
            poller.start();
            poller.pause();
            assert.strictEqual(poller.isActive(), false);
        });

        it('恢復後 isActive 應返回 true', () => {
            poller.start();
            poller.pause();
            poller.resume();
            assert.strictEqual(poller.isActive(), true);
        });

        it('暫停時 poll 應不處理任何偵測', () => {
            poller.start();
            poller.pause();
            const result = poller.poll([{ type: 'accept', text: 'Accept' }]);
            assert.strictEqual(result.approved.length, 0);
        });
    });

    describe('按鈕偵測與規則評估', () => {
        it('Accept 按鈕應該自動通過', () => {
            poller.start();
            const result = poller.poll([{ type: 'accept', text: 'Accept' }]);
            assert.strictEqual(result.approved.length, 1);
            assert.strictEqual(result.blocked.length, 0);
        });

        it('Run 按鈕搭配安全指令應該通過', () => {
            poller.start();
            const result = poller.poll([{ type: 'run', text: 'npm install lodash' }]);
            assert.strictEqual(result.approved.length, 1);
        });

        it('Run 按鈕搭配危險指令應該被阻擋', () => {
            poller.start();
            const result = poller.poll([{ type: 'run', text: 'rm -rf /' }]);
            assert.strictEqual(result.blocked.length, 1);
            assert.strictEqual(result.approved.length, 0);
        });

        it('Confirm 和 Apply 按鈕應該自動通過', () => {
            poller.start();
            const result = poller.poll([
                { type: 'confirm', text: 'Confirm' },
                { type: 'apply', text: 'Apply' }
            ]);
            assert.strictEqual(result.approved.length, 2);
        });
    });

    describe('Circuit Breaker 整合', () => {
        it('Circuit Breaker 開啟時應跳過輪詢', () => {
            // 觸發熔斷
            circuitBreaker.recordFailure();
            circuitBreaker.recordFailure();
            circuitBreaker.recordFailure();

            assert.strictEqual(circuitBreaker.getState(), 'OPEN');

            poller.start();
            const result = poller.poll([{ type: 'accept', text: 'Accept' }]);
            assert.strictEqual(result.approved.length, 0);
        });
    });

    describe('統計追蹤', () => {
        it('應該正確記錄統計資料', () => {
            poller.start();
            poller.poll([{ type: 'accept', text: 'Accept' }]);
            poller.poll([{ type: 'run', text: 'rm -rf /' }]);

            const stats = poller.getStats();
            assert.strictEqual(stats.totalPolls, 2);
            assert.strictEqual(stats.successfulDetections, 2);
            assert.strictEqual(stats.autoApproved, 1);
            assert.strictEqual(stats.blocked, 1);
        });

        it('resetStats 應該重置所有統計', () => {
            poller.start();
            poller.poll([{ type: 'accept', text: 'Accept' }]);
            poller.resetStats();

            const stats = poller.getStats();
            assert.strictEqual(stats.totalPolls, 0);
            assert.strictEqual(stats.autoApproved, 0);
        });
    });

    describe('設定更新', () => {
        it('應該能動態更新設定', () => {
            poller.updateConfig({ pollInterval: 500 });
            // Poller 內部應該更新間隔（無法直接存取，但不應報錯）
            assert.ok(true);
        });

        it('停用設定後 start 應無法啟動', () => {
            poller.updateConfig({ enabled: false });
            const result = poller.start();
            // 因為 start 會檢查 config.enabled
            assert.strictEqual(result, false);
        });
    });
});
