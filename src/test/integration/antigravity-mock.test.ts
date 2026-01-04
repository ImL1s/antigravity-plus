/**
 * Antigravity 整合測試 (Mock Server)
 * 
 * 驗證擴充功能是否能正確與 Antigravity API 互動
 */

import * as assert from 'assert';
import * as http from 'http';
import { AntigravityUsageProvider } from '../../providers/antigravity-usage';
import { Logger } from '../../utils/logger';

// Console Logger for debugging
class ConsoleLogger extends Logger {
    debug(message: string): void { console.log(`[DEBUG] ${message}`); }
    info(message: string): void { console.log(`[INFO] ${message}`); }
    warn(message: string): void { console.log(`[WARN] ${message}`); }
    error(message: string): void { console.log(`[ERROR] ${message}`); }
}

// Test Subclass: 暴露 protected/private 方法供測試使用，並 Mock 掉難以測試的部分
class TestableAntigravityUsageProvider extends AntigravityUsageProvider {
    constructor(logger: Logger, private mockPort: number) {
        super(logger);
    }

    // 覆寫 detectConnection，直接注入 Mock 連接資訊
    protected async detectConnection(): Promise<void> {
        console.log(`TestableAntigravityUsageProvider: detectConnection called, using port ${this.mockPort}`);
        // @ts-ignore
        this.connection = {
            port: this.mockPort,
            csrfToken: 'mock-token'
        };
    }
}

suite('Integration Tests - Antigravity Mock', () => {
    let server: http.Server;
    let serverPort: number;
    let lastRequest: { method: string, url: string, body?: any } | undefined;

    // 準備 Mock Server
    suiteSetup(async () => {
        server = http.createServer((req, res) => {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', () => {
                console.log(`[MockServer] Received ${req.method} ${req.url}`);
                const parsedBody = body ? JSON.parse(body) : undefined;
                lastRequest = {
                    method: req.method || '',
                    url: req.url || '',
                    body: parsedBody
                };

                res.setHeader('Content-Type', 'application/json');

                // 模擬 JSON-RPC API
                if (req.url === '/api' && req.method === 'POST') {
                    if (parsedBody && parsedBody.method === 'GetUserStatus') {
                        console.log('[MockServer] Handling GetUserStatus');
                        res.end(JSON.stringify({
                            jsonrpc: '2.0',
                            result: {
                                quotas: [
                                    {
                                        model: 'gemini-1.5-pro',
                                        limit: 50,
                                        usage: 10,
                                        resetTime: Date.now() + 3600000
                                    }
                                ]
                            },
                            id: parsedBody.id
                        }));
                        return;
                    }
                }

                console.log('[MockServer] 404 Not Found');
                res.statusCode = 404;
                res.end(JSON.stringify({ error: 'Not Found' }));
            });
        });

        // 使用 Port 0 讓 OS 自動分配
        await new Promise<void>((resolve) => {
            server.listen(0, '127.0.0.1', () => {
                // @ts-ignore
                serverPort = server.address().port;
                console.log(`Mock Antigravity Server running on port ${serverPort}`);
                resolve();
            });
        });
    });

    suiteTeardown(async () => {
        return new Promise<void>((resolve) => {
            server.close(() => resolve());
        });
    });

    setup(() => {
        lastRequest = undefined;
    });

    test('AntigravityUsageProvider 應該能從 API 獲取配額', async () => {
        const provider = new TestableAntigravityUsageProvider(new ConsoleLogger(), serverPort);

        const data = await provider.fetchQuota();

        assert.ok(data, '應該要獲取到數據');
        assert.strictEqual(lastRequest?.url, '/api', '應該發送請求到 /api');
        assert.strictEqual(lastRequest?.body?.method, 'GetUserStatus', '應該呼叫 GetUserStatus 方法');
        assert.ok(data?.models.length! > 0, '應該解析出模型數據');
    });
});
