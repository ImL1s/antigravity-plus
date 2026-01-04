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
                if (req.url === '/exa.language_server_pb.LanguageServerService/GetUserStatus' && req.method === 'POST') {
                    // Check if body is valid JSON
                    if (parsedBody && parsedBody.metadata) {
                        console.log('[MockServer] Handling GetUserStatus');
                        res.end(JSON.stringify({
                            userStatus: {
                                name: 'Test User',
                                email: 'test@example.com',
                                planStatus: {
                                    planInfo: { teamsTier: 'Pro' }
                                },
                                cascadeModelConfigData: {
                                    clientModelConfigs: [
                                        {
                                            modelOrAlias: { model: 'gemini-1.5-pro' },
                                            quotaInfo: {
                                                remainingFraction: 0.2, // 20% remaining -> 80% used
                                                resetTime: new Date(Date.now() + 3600000).toISOString()
                                            }
                                        }
                                    ]
                                }
                            }
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
        assert.strictEqual(lastRequest?.url, '/exa.language_server_pb.LanguageServerService/GetUserStatus', '應該發送請求到正確的 endpoint');
        assert.ok((data?.models.length ?? 0) > 0, '應該解析出模型數據');
    });
});
