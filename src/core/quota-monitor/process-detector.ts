/**
 * 進程偵測器 (Process Detector)
 * 
 * 基於 Antigravity Cockpit 的 ProcessHunter 和 Strategies 實作
 * 提供跨平台的 Antigravity Language Server 偵測與連接資訊提取
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as https from 'https';
import * as os from 'os';
import { Logger } from '../../utils/logger';

const execAsync = promisify(exec);

// ==========================================
// Constants
// ==========================================

const TIMING = {
    PROCESS_CMD_TIMEOUT_MS: 5000
};

const PROCESS_NAMES = {
    windows: 'language_server_windows_x64.exe',
    darwin_arm: 'language_server_darwin_arm64',
    darwin_x64: 'language_server_darwin_x64',
    linux: 'language_server_linux_x64'
};

const API_ENDPOINTS = {
    GET_UNLEASH_DATA: '/exa.language_server_pb.LanguageServerService/GetUnleashData'
};

// ==========================================
// Types
// ==========================================

export interface ProcessInfo {
    pid: number;
    ppid?: number;
    extensionPort: number;
    csrfToken: string;
}

export interface AntigravityProcess {
    pid: number;
    extensionPort: number;
    connectPort: number;
    csrfToken: string;
}

export interface PlatformStrategy {
    getProcessListCommand(processName: string): string;
    parseProcessInfo(stdout: string): ProcessInfo[];
    getPortListCommand(pid: number): string;
    parseListeningPorts(stdout: string): number[];
    ensurePortCommandAvailable?(): Promise<void>;
    getProcessByKeywordCommand?(): string;
}

// ==========================================
// Strategies
// ==========================================

export class WindowsStrategy implements PlatformStrategy {
    /**
     * Sanitize process name to prevent command injection.
     * Only allows alphanumeric characters, dots, underscores, and hyphens.
     */
    private sanitizeProcessName(name: string): string {
        return name.replace(/[^a-zA-Z0-9._-]/g, '');
    }

    private isAntigravityProcess(commandLine: string): boolean {
        if (!commandLine.includes('--extension_server_port')) return false;
        if (!commandLine.includes('--csrf_token')) return false;
        return /--app_data_dir\s+antigravity\b/i.test(commandLine);
    }

    getProcessListCommand(processName: string): string {
        const safeName = this.sanitizeProcessName(processName);
        const utf8Header = '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ';
        return `chcp 65001 >nul && powershell -NoProfile -Command "${utf8Header}Get-CimInstance Win32_Process -Filter 'name=''${safeName}''' | Select-Object ProcessId,CommandLine | ConvertTo-Json"`;
    }

    getProcessByKeywordCommand(): string {
        const utf8Header = '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ';
        return `chcp 65001 >nul && powershell -NoProfile -Command "${utf8Header}Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'csrf_token' } | Select-Object ProcessId,Name,CommandLine | ConvertTo-Json"`;
    }

    parseProcessInfo(stdout: string): ProcessInfo[] {
        let cleanStdout = stdout;
        try {
            const jsonStart = stdout.indexOf('[');
            const jsonObjectStart = stdout.indexOf('{');

            if (jsonStart >= 0 || jsonObjectStart >= 0) {
                const start = (jsonStart >= 0 && jsonObjectStart >= 0)
                    ? Math.min(jsonStart, jsonObjectStart)
                    : Math.max(jsonStart, jsonObjectStart);
                cleanStdout = stdout.substring(start);
            }

            let data = JSON.parse(cleanStdout.trim());
            if (!Array.isArray(data)) {
                data = [data];
            }

            const candidates: ProcessInfo[] = [];

            for (const item of data) {
                const commandLine = item.CommandLine || '';
                // Filter to only Antigravity processes with required flags
                if (!commandLine || !this.isAntigravityProcess(commandLine)) {
                    continue;
                }

                const pid = item.ProcessId;
                if (!pid) continue;

                const portMatch = commandLine.match(/--extension_server_port[=\s]+(\d+)/);
                const tokenMatch = commandLine.match(/--csrf_token[=\s]+([a-zA-Z0-9-]+)/i);

                if (portMatch && tokenMatch) {
                    candidates.push({
                        pid,
                        extensionPort: parseInt(portMatch[1], 10),
                        csrfToken: tokenMatch[1]
                    });
                }
            }
            return candidates;
        } catch (e) {
            console.error('JSON Parse Error:', e);
            console.log('Attempted to parse:', cleanStdout ? cleanStdout.trim() : 'null');
            return [];
        }
    }

    getPortListCommand(pid: number): string {
        return `chcp 65001 >nul && netstat -ano | findstr "${pid}" | findstr "LISTENING"`;
    }

    parseListeningPorts(stdout: string): number[] {
        const portRegex = /(?:127\.0\.0\.1|0\.0\.0\.0|\[::1?\]):(\d+)\s+\S+\s+LISTENING/gi;
        const ports: number[] = [];
        let match;
        while ((match = portRegex.exec(stdout)) !== null) {
            const port = parseInt(match[1], 10);
            if (!ports.includes(port)) ports.push(port);
        }
        return ports.sort((a, b) => a - b);
    }
}

export class UnixStrategy implements PlatformStrategy {
    private platform: string;
    private availablePortCommand: 'lsof' | 'ss' | 'netstat' | null = null;

    constructor(platform: string) {
        this.platform = platform;
    }

    async ensurePortCommandAvailable(): Promise<void> {
        if (this.availablePortCommand) return;
        const commands = ['lsof', 'ss', 'netstat'];
        for (const cmd of commands) {
            try {
                await execAsync(`which ${cmd}`);
                this.availablePortCommand = cmd as any;
                return;
            } catch { /* command not available */ }
        }
    }

    private isAntigravityProcess(commandLine: string): boolean {
        if (!commandLine.includes('--extension_server_port')) return false;
        if (!commandLine.includes('--csrf_token')) return false;
        return /--app_data_dir\s+antigravity\b/i.test(commandLine);
    }

    /**
     * Sanitize process name to prevent command injection.
     * Only allows alphanumeric characters, dots, underscores, and hyphens.
     */
    private sanitizeProcessName(name: string): string {
        return name.replace(/[^a-zA-Z0-9._-]/g, '');
    }

    getProcessListCommand(processName: string): string {
        const safeName = this.sanitizeProcessName(processName);
        return `ps -ww -eo pid,ppid,args | grep "${safeName}" | grep -v grep`;
    }

    parseProcessInfo(stdout: string): ProcessInfo[] {
        const lines = stdout.split('\n').filter(line => line.trim());
        const candidates: ProcessInfo[] = [];

        for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            if (parts.length < 3) continue;

            const pid = parseInt(parts[0], 10);
            const ppid = parseInt(parts[1], 10);
            const cmd = parts.slice(2).join(' ');

            if (isNaN(pid) || isNaN(ppid)) continue;

            const portMatch = cmd.match(/--extension_server_port[=\s]+(\d+)/);
            const tokenMatch = cmd.match(/--csrf_token[=\s]+([a-zA-Z0-9-]+)/i);

            if (portMatch && tokenMatch && this.isAntigravityProcess(cmd)) {
                candidates.push({
                    pid,
                    ppid,
                    extensionPort: parseInt(portMatch[1], 10),
                    csrfToken: tokenMatch[1]
                });
            } else {
                // console.log('DEBUG: Rejecting', cmd, tokenMatch, this.isAntigravityProcess(cmd));
            }
        }
        return candidates;
    }

    getPortListCommand(pid: number): string {
        if (this.platform === 'darwin') {
            return `lsof -nP -a -iTCP -sTCP:LISTEN -p ${pid} 2>/dev/null | grep -E "^\\S+\\s+${pid}\\s"`;
        }

        switch (this.availablePortCommand) {
            case 'lsof': return `lsof -nP -a -iTCP -sTCP:LISTEN -p ${pid} 2>/dev/null | grep -E "^\\S+\\s+${pid}\\s"`;
            case 'ss': return `ss -tlnp 2>/dev/null | grep "pid=${pid},"`;
            case 'netstat': return `netstat -tulpn 2>/dev/null | grep ${pid}`;
            default: return `ss -tlnp 2>/dev/null | grep "pid=${pid},"`;
        }
    }

    parseListeningPorts(stdout: string): number[] {
        const ports: number[] = [];
        if (this.platform === 'darwin') {
            const lines = stdout.split('\n');
            for (const line of lines) {
                if (!line.includes('(LISTEN)')) continue;
                const match = line.match(/[*\d.:]+:(\d+)\s+\(LISTEN\)/);
                if (match) {
                    const port = parseInt(match[1], 10);
                    if (!ports.includes(port)) ports.push(port);
                }
            }
        } else {
            const ssRegex = /LISTEN\s+\d+\s+\d+\s+(?:\*|[\d.]+|\[[\da-f:]*\]):(\d+)/gi;
            let match;
            while ((match = ssRegex.exec(stdout)) !== null) {
                const port = parseInt(match[1], 10);
                if (!ports.includes(port)) ports.push(port);
            }
        }
        return ports.sort((a, b) => a - b);
    }
}

// ==========================================
// ProcessDetector (Facade)
// ==========================================

export class ProcessDetector {
    private strategy: PlatformStrategy;
    private targetProcess: string;

    constructor(private logger: Logger) {
        const platform = os.platform();
        const arch = os.arch();

        if (platform === 'win32') {
            this.strategy = new WindowsStrategy();
            this.targetProcess = PROCESS_NAMES.windows;
        } else if (platform === 'darwin') {
            this.strategy = new UnixStrategy('darwin');
            this.targetProcess = arch === 'arm64' ? PROCESS_NAMES.darwin_arm : PROCESS_NAMES.darwin_x64;
        } else {
            this.strategy = new UnixStrategy('linux');
            this.targetProcess = PROCESS_NAMES.linux;
        }
    }

    public async detect(): Promise<AntigravityProcess | null> {
        // 1. Scan by process name
        let result = await this.scanByProcessName();
        if (result) return result;

        // 2. Scan by keyword (Windows only)
        if (os.platform() === 'win32') {
            result = await this.scanByKeyword();
            if (result) return result;
        }

        return null;
    }

    private async scanByProcessName(): Promise<AntigravityProcess | null> {
        try {
            const cmd = this.strategy.getProcessListCommand(this.targetProcess);
            const { stdout } = await execAsync(cmd, { timeout: TIMING.PROCESS_CMD_TIMEOUT_MS });

            if (!stdout || !stdout.trim()) return null;

            const candidates = this.strategy.parseProcessInfo(stdout);
            for (const info of candidates) {
                const result = await this.verifyAndConnect(info);
                if (result) return result;
            }
        } catch (error) {
            this.logger.debug(`Scan by process name failed: ${error}`);
        }
        return null;
    }

    private async scanByKeyword(): Promise<AntigravityProcess | null> {
        if (!this.strategy.getProcessByKeywordCommand) return null;

        try {
            const cmd = this.strategy.getProcessByKeywordCommand();
            const { stdout } = await execAsync(cmd, { timeout: TIMING.PROCESS_CMD_TIMEOUT_MS });

            const candidates = this.strategy.parseProcessInfo(stdout);
            for (const info of candidates) {
                const result = await this.verifyAndConnect(info);
                if (result) return result;
            }
        } catch (error) {
            this.logger.debug(`Scan by keyword failed: ${error}`);
        }
        return null;
    }

    private async verifyAndConnect(info: ProcessInfo): Promise<AntigravityProcess | null> {
        try {
            if (this.strategy.ensurePortCommandAvailable) {
                await this.strategy.ensurePortCommandAvailable();
            }

            const cmd = this.strategy.getPortListCommand(info.pid);
            const { stdout } = await execAsync(cmd);
            const ports = this.strategy.parseListeningPorts(stdout);

            for (const port of ports) {
                if (await this.pingPort(port, info.csrfToken)) {
                    return {
                        pid: info.pid,
                        extensionPort: info.extensionPort,
                        connectPort: port,
                        csrfToken: info.csrfToken
                    };
                }
            }
        } catch (error) {
            this.logger.debug(`Verification failed for PID ${info.pid}: ${error}`);
        }
        return null;
    }

    private pingPort(port: number, token: string): Promise<boolean> {
        return new Promise(resolve => {
            const options: https.RequestOptions = {
                hostname: '127.0.0.1',
                port,
                path: API_ENDPOINTS.GET_UNLEASH_DATA,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Codeium-Csrf-Token': token,
                    'Connect-Protocol-Version': '1',
                },
                rejectUnauthorized: false,
                timeout: 3000,
                agent: false,
            };

            const req = https.request(options, res => resolve(res.statusCode === 200));
            req.on('error', () => resolve(false));
            req.on('timeout', () => { req.destroy(); resolve(false); });
            req.write(JSON.stringify({ wrapper_data: {} }));
            req.end();
        });
    }
}
