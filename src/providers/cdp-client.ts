/**
 * CDP (Chrome DevTools Protocol) 客戶端
 * 
 * 用於深度整合 Antigravity，實現自動核准功能
 * 
 * 參考 Yoke AntiGravity 的 CDP 整合方式
 */

import { Logger } from '../utils/logger';
import WebSocket from 'ws';
import * as http from 'http';

export class CDPClient {
    private ws: WebSocket | undefined;
    private messageId = 0;
    private pendingMessages: Map<number, { resolve: (value: any) => void; reject: (reason?: any) => void }> = new Map();
    private connected = false;

    constructor(private logger: Logger) { }

    /**
     * 連接到 CDP
     */
    public async connect(): Promise<void> {
        this.logger.debug('正在連接 CDP...');

        // 嘗試連接到 Antigravity 的 DevTools
        const wsUrl = await this.findDevToolsWebSocket();

        if (!wsUrl) {
            throw new Error('找不到 DevTools WebSocket 端點');
        }

        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(wsUrl);

                this.ws.on('open', () => {
                    this.connected = true;
                    this.logger.info('CDP 已連接');
                    resolve();
                });

                this.ws.on('message', (data: WebSocket.Data) => {
                    this.handleMessage(data.toString());
                });

                this.ws.on('close', () => {
                    this.connected = false;
                    this.logger.info('CDP 已斷開');
                });

                this.ws.on('error', (error) => {
                    this.logger.error(`CDP 錯誤: ${error.message}`);
                    reject(error);
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * 尋找 DevTools WebSocket 端點
     */
    private async findDevToolsWebSocket(): Promise<string | undefined> {
        // 嘗試常見的 DevTools 端點
        const endpoints = [
            'http://localhost:9222/json/version',
            'http://localhost:9333/json/version',
            'http://localhost:9444/json/version'
        ];

        for (const endpoint of endpoints) {
            try {
                const response = await this.httpGet(endpoint);
                const json = JSON.parse(response);
                if (json.webSocketDebuggerUrl) {
                    return json.webSocketDebuggerUrl;
                }
            } catch {
                // 繼續嘗試下一個
            }
        }

        return undefined;
    }

    /**
     * HTTP GET 請求
     */
    private httpGet(url: string): Promise<string> {
        return new Promise((resolve, reject) => {
            http.get(url, { timeout: 3000 }, (res: any) => {
                let data = '';
                res.on('data', (chunk: string) => data += chunk);
                res.on('end', () => resolve(data));
            }).on('error', reject);
        });
    }

    /**
     * 發送 CDP 指令
     */
    public async send(method: string, params: any = {}): Promise<any> {
        if (!this.connected || !this.ws) {
            throw new Error('CDP 未連接');
        }

        const id = ++this.messageId;

        return new Promise((resolve, reject) => {
            this.pendingMessages.set(id, { resolve, reject });

            const message = JSON.stringify({ id, method, params });
            this.ws!.send(message);

            // 設定超時
            setTimeout(() => {
                if (this.pendingMessages.has(id)) {
                    this.pendingMessages.delete(id);
                    reject(new Error('CDP 請求超時'));
                }
            }, 30000);
        });
    }

    /**
     * 處理接收的訊息
     */
    private handleMessage(data: string): void {
        try {
            const message = JSON.parse(data);

            if (message.id && this.pendingMessages.has(message.id)) {
                const { resolve, reject } = this.pendingMessages.get(message.id)!;
                this.pendingMessages.delete(message.id);

                if (message.error) {
                    reject(new Error(message.error.message));
                } else {
                    resolve(message.result);
                }
            }

            // 處理事件
            if (message.method) {
                this.handleEvent(message.method, message.params);
            }
        } catch (error) {
            this.logger.error(`解析 CDP 訊息失敗: ${error}`);
        }
    }

    /**
     * 處理 CDP 事件
     */
    private handleEvent(method: string, _params: any): void {
        // 可以在這裡監聽特定事件
        this.logger.debug(`CDP 事件: ${method}`);
    }

    /**
     * 注入腳本
     */
    public async injectScript(script: string): Promise<any> {
        return this.send('Runtime.evaluate', {
            expression: script,
            awaitPromise: true,
            returnByValue: true
        });
    }

    /**
     * 模擬點擊
     */
    public async click(selector: string): Promise<void> {
        const script = `
            (function() {
                const element = document.querySelector('${selector}');
                if (element) {
                    element.click();
                    return true;
                }
                return false;
            })()
        `;

        await this.injectScript(script);
    }

    /**
     * 檢查是否已連接
     */
    public isConnected(): boolean {
        return this.connected;
    }

    /**
     * 斷開連接
     */
    public disconnect(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = undefined;
        }
        this.connected = false;
    }
}
