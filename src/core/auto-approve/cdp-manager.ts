
import * as vscode from 'vscode';
import * as http from 'http';
import WebSocket = require('ws');
import { Logger } from '../../utils/logger';
import { FULL_CDP_SCRIPT } from './scripts/full-cdp-script';

interface CDPTarget {
    id: string;
    type: string;
    url: string;
    webSocketDebuggerUrl?: string;
}

interface AutoApproveConfig {
    denyList: string[];
    allowList: string[];
    clickInterval: number;
}

export class CDPManager implements vscode.Disposable {
    private isConnectorActive: boolean = false;
    private connectedSocket: WebSocket | null = null;
    private portRange = [9000, 9003];
    private msgId = 1;

    // Allow injection of WebSocket constructor for testing
    constructor(
        private logger: Logger,
        private WebSocketCtor: typeof WebSocket = WebSocket
    ) { }

    public async tryConnectAndInject(config?: AutoApproveConfig): Promise<boolean> {
        if (this.isConnectorActive && this.connectedSocket?.readyState === WebSocket.OPEN) {
            // Already connected, just update config if provided
            if (config) {
                await this.updateConfig(config);
            }
            return true;
        }

        const port = await this.findAvailableCDPPort();
        if (port) {
            this.logger.info(`CDP Port found: ${port}. Attempting to connect...`);
            try {
                const target = await this.findPageTarget(port);
                if (target && target.webSocketDebuggerUrl) {
                    await this.connectToWebSocket(target.webSocketDebuggerUrl);
                    await this.injectScript();
                    if (config) {
                        await this.startAgent(config);
                    }
                    return true;
                }
            } catch (e) {
                this.logger.error(`Failed to connect to CDP: ${e}`);
            }
        }
        return false;
    }

    private async findAvailableCDPPort(): Promise<number | null> {
        for (let port = this.portRange[0]; port <= this.portRange[1]; port++) {
            if (await this.checkPort(port)) {
                return port;
            }
        }
        return null;
    }

    private checkPort(port: number): Promise<boolean> {
        return new Promise((resolve) => {
            const timeout = setTimeout(() => resolve(false), 1000); // 1秒超時
            const req = http.get(`http://127.0.0.1:${port}/json/version`, (res) => {
                clearTimeout(timeout);
                resolve(res.statusCode === 200);
            });
            req.on('error', () => {
                clearTimeout(timeout);
                resolve(false);
            });
            req.setTimeout(1000, () => {
                req.destroy();
                resolve(false);
            });
            req.end();
        });
    }

    private findPageTarget(port: number): Promise<CDPTarget | undefined> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => resolve(undefined), 2000); // 2秒超時
            const req = http.get(`http://127.0.0.1:${port}/json/list`, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    clearTimeout(timeout);
                    try {
                        const targets = JSON.parse(data) as CDPTarget[];
                        const target = targets.find(t => t.webSocketDebuggerUrl && (t.type === 'page' || t.type === 'webview'));
                        resolve(target);
                    } catch (e) {
                        reject(e);
                    }
                });
            });
            req.on('error', (e) => {
                clearTimeout(timeout);
                reject(e);
            });
            req.setTimeout(2000, () => {
                req.destroy();
                resolve(undefined);
            });
        });
    }

    private connectToWebSocket(url: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.logger.warn('WebSocket connection timeout');
                reject(new Error('WebSocket connection timeout'));
            }, 5000); // 5秒超時

            this.connectedSocket = new this.WebSocketCtor(url);

            this.connectedSocket.on('open', async () => {
                clearTimeout(timeout);
                this.isConnectorActive = true;
                this.logger.info('Connected to CDP WebSocket');
                resolve();
            });

            this.connectedSocket.on('error', (e) => {
                clearTimeout(timeout);
                this.logger.error(`CDP WebSocket Error: ${e}`);
                this.isConnectorActive = false;
                reject(e);
            });

            this.connectedSocket.on('close', () => {
                this.isConnectorActive = false;
                this.logger.info('CDP WebSocket Closed');
            });
        });
    }

    private async injectScript() {
        if (!this.connectedSocket) return;
        await this.sendCommand('Runtime.evaluate', {
            expression: FULL_CDP_SCRIPT,
            includeCommandLineAPI: true
        });
        this.logger.info('Auto Accept Script Injected via CDP');
    }

    private async startAgent(config: AutoApproveConfig) {
        const expression = `window.__antigravityPlus && window.__antigravityPlus.start(${JSON.stringify(config)})`;
        await this.sendCommand('Runtime.evaluate', { expression });
    }

    private async updateConfig(config: AutoApproveConfig) {
        const expression = `window.__antigravityPlus && window.__antigravityPlus.setConfig(${JSON.stringify(config)})`;
        await this.sendCommand('Runtime.evaluate', { expression });
    }

    private sendCommand(method: string, params: any): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this.connectedSocket || this.connectedSocket.readyState !== WebSocket.OPEN) {
                return reject(new Error('WebSocket not open'));
            }
            const id = this.msgId++;
            const message = JSON.stringify({ id, method, params });

            const listener = (data: any) => {
                const response = JSON.parse(data.toString());
                if (response.id === id) {
                    this.connectedSocket?.removeListener('message', listener);
                    if (response.error) reject(response.error);
                    else resolve(response.result);
                }
            };

            this.connectedSocket.on('message', listener);
            this.connectedSocket.send(message);
        });
    }

    public dispose() {
        if (this.connectedSocket) {
            this.connectedSocket.terminate();
            this.connectedSocket = null;
        }
        this.isConnectorActive = false;
    }
}
