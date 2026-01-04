/**
 * System Scheduler - 系統排程整合
 * 
 * 使用 Windows Task Scheduler 讓 VS Code 關閉時也能執行
 */

import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Logger } from '../../utils/logger';
import * as fs from 'fs';

const execAsync = promisify(exec);

const TASK_NAME = 'AntigravityPlusWakeup';

interface WakeupConfig {
    mode: string;
    workStartTime: string;
    fixedTimes: string[];
    cronExpression: string;
}

export class SystemScheduler {
    private platform: NodeJS.Platform;

    constructor(private logger: Logger) {
        this.platform = os.platform();
    }

    /**
     * 建立系統排程任務
     */
    public async createTask(config: WakeupConfig): Promise<boolean> {
        try {
            // 先移除舊任務
            await this.removeTask();

            const triggerTime = this.calculateTriggerTime(config);

            switch (this.platform) {
                case 'win32':
                    return await this.createWindowsTask(triggerTime);
                case 'darwin':
                    return await this.createMacTask(triggerTime);
                case 'linux':
                    return await this.createLinuxTask(triggerTime);
                default:
                    this.logger.warn(`不支援的平台: ${this.platform}`);
                    return false;
            }
        } catch (error) {
            this.logger.error(`建立系統排程失敗: ${error}`);
            return false;
        }
    }

    /**
     * 計算觸發時間
     */
    private calculateTriggerTime(config: WakeupConfig): string {
        if (config.mode === 'smart') {
            const [hours, minutes] = config.workStartTime.split(':').map(Number);
            let wakeHours = hours - 3;
            if (wakeHours < 0) wakeHours += 24;
            return `${wakeHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        }

        if (config.mode === 'fixed' && config.fixedTimes.length > 0) {
            return config.fixedTimes[0];
        }

        return '06:00';
    }

    /**
     * 建立 Windows Task Scheduler 任務
     */
    private async createWindowsTask(time: string): Promise<boolean> {
        const [hours, minutes] = time.split(':');

        // 建立觸發 Antigravity 的腳本
        const scriptPath = `${process.env.TEMP}\\antigravity_wakeup.ps1`;
        const scriptContent = `
# Antigravity Plus Auto Wake-up
Start-Process "code" -ArgumentList "--folder-uri", "antigravity-wakeup://trigger"
Start-Sleep -Seconds 30
# Optional: 發送簡單請求觸發配額計時器
`;

        // 使用 schtasks 建立任務
        const command = `schtasks /create /tn "${TASK_NAME}" /tr "powershell.exe -ExecutionPolicy Bypass -File '${scriptPath}'" /sc daily /st ${hours}:${minutes} /f`;

        try {
            fs.writeFileSync(scriptPath, scriptContent);
            await execAsync(command);
            this.logger.info(`Windows 排程任務已建立: ${time}`);
            return true;
        } catch (error) {
            this.logger.error(`建立 Windows 排程失敗: ${error}`);
            return false;
        }
    }

    /**
     * 建立 macOS launchd 任務
     */
    private async createMacTask(time: string): Promise<boolean> {
        const [hours, minutes] = time.split(':').map(Number);

        const plistPath = `${os.homedir()}/Library/LaunchAgents/com.antigravityplus.wakeup.plist`;
        const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.antigravityplus.wakeup</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/code</string>
        <string>--folder-uri</string>
        <string>antigravity-wakeup://trigger</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>${hours}</integer>
        <key>Minute</key>
        <integer>${minutes}</integer>
    </dict>
</dict>
</plist>`;

        try {
            fs.writeFileSync(plistPath, plistContent);
            await execAsync(`launchctl load ${plistPath}`);
            this.logger.info(`macOS launchd 任務已建立: ${time}`);
            return true;
        } catch (error) {
            this.logger.error(`建立 macOS 排程失敗: ${error}`);
            return false;
        }
    }

    /**
     * 建立 Linux cron 任務
     */
    private async createLinuxTask(time: string): Promise<boolean> {
        const [hours, minutes] = time.split(':');
        const cronLine = `${minutes} ${hours} * * * code --folder-uri "antigravity-wakeup://trigger"`;

        try {
            // 取得現有 crontab
            let existingCron = '';
            try {
                const result = await execAsync('crontab -l');
                existingCron = result.stdout;
            } catch {
                // 沒有現有 crontab
            }

            // 移除舊的 antigravity 任務
            const lines = existingCron.split('\n').filter(l => !l.includes('antigravity-wakeup'));
            lines.push(cronLine);

            // 寫入新的 crontab
            const newCron = lines.join('\n');
            await execAsync(`echo "${newCron}" | crontab -`);

            this.logger.info(`Linux cron 任務已建立: ${time}`);
            return true;
        } catch (error) {
            this.logger.error(`建立 Linux 排程失敗: ${error}`);
            return false;
        }
    }

    /**
     * 移除系統排程任務
     */
    public async removeTask(): Promise<boolean> {
        try {
            switch (this.platform) {
                case 'win32':
                    await execAsync(`schtasks /delete /tn "${TASK_NAME}" /f`).catch(() => { });
                    break;
                case 'darwin':
                    const plistPath = `${os.homedir()}/Library/LaunchAgents/com.antigravityplus.wakeup.plist`;
                    await execAsync(`launchctl unload ${plistPath}`).catch(() => { });
                    break;
                case 'linux':
                    const result = await execAsync('crontab -l').catch(() => ({ stdout: '' }));
                    const lines = result.stdout.split('\n').filter((l: string) => !l.includes('antigravity-wakeup'));
                    await execAsync(`echo "${lines.join('\n')}" | crontab -`).catch(() => { });
                    break;
            }
            return true;
        } catch (error) {
            this.logger.debug(`移除系統排程時發生錯誤（可能不存在）: ${error}`);
            return false;
        }
    }

    /**
     * 檢查任務是否存在
     */
    public async taskExists(): Promise<boolean> {
        try {
            switch (this.platform) {
                case 'win32':
                    await execAsync(`schtasks /query /tn "${TASK_NAME}"`);
                    return true;
                case 'darwin':
                    return fs.existsSync(`${os.homedir()}/Library/LaunchAgents/com.antigravityplus.wakeup.plist`);
                case 'linux':
                    const result = await execAsync('crontab -l');
                    return result.stdout.includes('antigravity-wakeup');
                default:
                    return false;
            }
        } catch {
            return false;
        }
    }
}
