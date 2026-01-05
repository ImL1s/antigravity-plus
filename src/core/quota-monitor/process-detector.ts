/**
 * 進程偵測器
 * 
 * 參考 AntigravityQuota 的實作
 * 
 * 跨平台偵測 Antigravity 進程並提取連接資訊
 */

import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as http from 'http';
import { Logger } from '../../utils/logger';

const execAsync = promisify(exec);

export interface AntigravityProcess {
    pid: number;
    endpoint: string;
    authToken?: string;
}

export type CommandExecutor = (command: string, options?: any) => Promise<{ stdout: string, stderr: string }>;

export class ProcessDetector {
    private readonly COMMON_PORTS = [9222, 9333, 9444, 3000, 3001, 8080, 8888];
    private executor: CommandExecutor;

    constructor(private logger: Logger, executor?: CommandExecutor, private httpClient?: any) {
        this.executor = executor || execAsync;
        this.httpClient = httpClient || http;
    }

    /**
     * 偵測 Antigravity 進程
     */
    public async detect(): Promise<AntigravityProcess | null> {
        const platform = os.platform();

        this.logger.debug(`開始偵測 Antigravity 進程 (${platform})`);

        try {
            switch (platform) {
                case 'win32':
                    return await this.detectWindows();
                case 'darwin':
                    return await this.detectMac();
                case 'linux':
                    return await this.detectLinux();
                default:
                    this.logger.warn(`不支援的平台: ${platform}`);
                    return null;
            }
        } catch (error) {
            this.logger.error(`進程偵測失敗: ${error}`);
            return null;
        }
    }

    /**
     * Windows 平台偵測
     * 模擬 competitor-cockpit/hunter.ts 的 WMI 查詢策略
     */
    private async detectWindows(): Promise<AntigravityProcess | null> {
        try {
            // 擴大搜尋範圍，包含 code.exe, electron.exe 和潛在的 antigravity process
            const { stdout } = await this.executor(
                `wmic process where "name like '%code%' or name like '%electron%' or name like '%antigravity%'" get processid,commandline /format:csv`,
                { timeout: 15000 }
            );

            const lines = stdout.trim().split('\n');
            const candidates: { pid: number, port: number }[] = [];

            for (const line of lines) {
                if (!line.trim() || line.startsWith('Node,')) continue;

                // CSV 格式通常是: Node,CommandLine,ProcessId
                // 部分系統可能是: Node,ProcessId,CommandLine
                const parts = line.split(',');
                if (parts.length < 2) continue;

                // 嘗試找尋 Command Line 部分 (通常比較長)
                const cmdLine = parts.find(p => p.includes('--remote-debugging-port')) || '';
                const pidStr = parts[parts.length - 1]; // PID 通常在最後

                if (cmdLine) {
                    const portMatch = cmdLine.match(/--remote-debugging-port=(\d+)/);
                    if (portMatch) {
                        const port = parseInt(portMatch[1]);
                        const pid = parseInt(pidStr) || 0;
                        candidates.push({ pid, port });
                    }
                }
            }

            this.logger.debug(`Windows 掃描發現 ${candidates.length} 個候選進程`);

            // 驗證所有候選者
            for (const cand of candidates) {
                const process = await this.testPort(cand.port, cand.pid);
                if (process) {
                    this.logger.info(`驗證成功: PID ${cand.pid} Port ${cand.port}`);
                    return process;
                }
            }
        } catch (error) {
            this.logger.debug(`Windows wmic 偵測失敗: ${error}`);
        }

        return this.tryCommonPorts();
    }

    /**
     * macOS 平台偵測
     * 模擬 competitor-cockpit/hunter.ts 的 ps aux 策略
     */
    private async detectMac(): Promise<AntigravityProcess | null> {
        try {
            // 使用 grep 排除 grep 自身，並查找包含 debugging-port 的進程
            const { stdout } = await this.executor(
                `ps aux | grep "\\--remote-debugging-port=" | grep -v grep`,
                { timeout: 15000 }
            );

            const lines = stdout.trim().split('\n').filter(Boolean);

            for (const line of lines) {
                // ps aux 輸出格式: USER PID %CPU %MEM VSZ RSS TT STAT STARTED TIME COMMAND
                // 我們主要關心 PID 和 COMMAND
                const parts = line.trim().split(/\s+/);
                this.logger.debug(`[Mac] Line parts: ${JSON.stringify(parts)}`); // DEBUG
                const pid = parseInt(parts[1]);
                this.logger.debug(`[Mac] Parsed PID: ${pid}`); // DEBUG
                this.logger.debug(`[Mac] Parsed PID: ${pid}`); // DEBUG
                // const cmdLine = parts.slice(10).join(' '); // 假設 Command 從第 11 欄開始

                const portMatch = line.match(/--remote-debugging-port=(\d+)/);
                if (portMatch) {
                    const port = parseInt(portMatch[1]);
                    const process = await this.testPort(port, pid);
                    if (process) return process;
                }
            }
        } catch (error) {
            this.logger.debug(`macOS 偵測失敗: ${error}`);
        }

        return this.tryCommonPorts();
    }

    /**
     * Linux 平台偵測
     */
    private async detectLinux(): Promise<AntigravityProcess | null> {
        try {
            const { stdout } = await this.executor(
                `ps -ef | grep "\\--remote-debugging-port=" | grep -v grep`,
                { timeout: 15000 }
            );

            const lines = stdout.trim().split('\n').filter(Boolean);

            for (const line of lines) {
                const parts = line.trim().split(/\s+/);
                const pid = parseInt(parts[1]);

                const portMatch = line.match(/--remote-debugging-port=(\d+)/);
                if (portMatch) {
                    const port = parseInt(portMatch[1]);
                    const process = await this.testPort(port, pid);
                    if (process) return process;
                }
            }
        } catch (error) {
            this.logger.debug(`Linux 偵測失敗: ${error}`);
        }

        return this.tryCommonPorts();
    }

    /**
     * 嘗試常見端口
     */
    private async tryCommonPorts(): Promise<AntigravityProcess | null> {
        this.logger.debug('嘗試常見端口...');

        for (const port of this.COMMON_PORTS) {
            const process = await this.testPort(port);
            if (process) {
                this.logger.info(`在端口 ${port} 找到 Antigravity`);
                return process;
            }
        }

        return null;
    }

    /**
     * 測試端口是否為 Antigravity 服務
     */
    private async testPort(port: number, pid?: number): Promise<AntigravityProcess | null> {
        return new Promise((resolve) => {
            const options = {
                hostname: 'localhost',
                port: port,
                path: '/json/version',
                method: 'GET',
                timeout: 2000
            };

            const req = this.httpClient.request(options, (res: any) => {
                let data = '';
                res.on('data', (chunk: string) => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        // 檢查是否為 Antigravity 或相容的服務
                        if (json.Browser || json.webSocketDebuggerUrl) {
                            resolve({
                                pid: pid || 0,
                                endpoint: `http://localhost:${port}/api`,
                                authToken: json.webSocketDebuggerUrl
                            });
                            return;
                        }
                    } catch {
                        // 忽略解析錯誤
                    }
                    resolve(null);
                });
            });

            req.on('error', () => resolve(null));
            req.on('timeout', () => {
                req.destroy();
                resolve(null);
            });

            req.end();
        });
    }
}
