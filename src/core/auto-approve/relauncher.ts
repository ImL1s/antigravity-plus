/**
 * Relauncher - 自動設定 CDP Port 並重啟 IDE
 * 
 * 參考 MunKhin/auto-accept-agent 的實作
 * 支援 Windows, macOS, Linux 的捷徑修改與重啟
 */

import * as vscode from 'vscode';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';
import { Logger } from '../../utils/logger';

const CDP_PORT = 9000;
const CDP_FLAG = `--remote-debugging-port=${CDP_PORT}`;

export class Relauncher {
    private platform: string;

    constructor(private logger: Logger) {
        this.platform = os.platform();
    }

    /**
     * 獲取當前 IDE 名稱
     */
    private getIdeName(): string {
        const appName = vscode.env.appName || '';
        if (appName.toLowerCase().includes('cursor')) return 'Cursor';
        if (appName.toLowerCase().includes('antigravity')) return 'Antigravity';
        return 'Code';
    }

    /**
     * 確保 CDP 標誌存在，否則嘗試修改並重啟
     */
    public async ensureCDPAndRelaunch(): Promise<{ success: boolean; relaunched: boolean }> {
        this.logger.info('[Relauncher] Checking shortcut for CDP flag...');
        const hasFlag = await this.checkShortcutFlag();

        if (hasFlag) {
            this.logger.info('[Relauncher] CDP flag already present.');
            return { success: true, relaunched: false };
        }

        this.logger.info('[Relauncher] CDP flag missing. Attempting to modify shortcut...');

        // 詢問使用者是否允許修改
        const permission = await vscode.window.showWarningMessage(
            'Antigravity+ 需要修改 IDE 啟動捷徑以加入 Chrome DevTools Protocol 選項 (CDP)。這將允許擴展自動接受建議。是否繼續？',
            '是，修改並重啟',
            '取消'
        );

        if (permission !== '是，修改並重啟') {
            return { success: false, relaunched: false };
        }

        const modified = await this.modifyShortcut();

        if (modified) {
            this.logger.info('[Relauncher] Shortcut modified successfully. Prompting for restart...');
            const choice = await vscode.window.showInformationMessage(
                '設定已完成。需要重啟 IDE 才能生效。是否立即重啟？',
                '立即重啟',
                '稍後'
            );

            if (choice === '立即重啟') {
                await this.relaunch();
                return { success: true, relaunched: true };
            }
        } else {
            this.logger.error('[Relauncher] Failed to modify shortcut automatically.');
            vscode.window.showErrorMessage('Antigravity+: 無法自動修改捷徑。請手動將 --remote-debugging-port=9000 加入啟動參數。');
        }

        return { success: false, relaunched: false };
    }

    /**
     * 檢查當前進程是否包含 CDP 標誌
     */
    private async checkShortcutFlag(): Promise<boolean> {
        // 從 process.argv 檢查啟動參數
        const args = process.argv.join(' ');
        this.logger.debug(`[Relauncher] Process args: ${args}`);
        return args.includes(`--remote-debugging-port=${CDP_PORT}`);
    }

    /**
     * 修改啟動捷徑
     */
    private async modifyShortcut(): Promise<boolean> {
        try {
            if (this.platform === 'win32') {
                return await this.modifyWindowsShortcut();
            }
            // macOS 和 Linux 實作保留為 TODO
            if (this.platform === 'darwin') {
                // return await this.modifyMacOSShortcut();
                this.logger.warn('[Relauncher] macOS shortcut modification not yet implemented.');
                return false;
            }
            if (this.platform === 'linux') {
                // return await this.modifyLinuxShortcut();
                this.logger.warn('[Relauncher] Linux shortcut modification not yet implemented.');
                return false;
            }
        } catch (e) {
            const error = e as Error;
            this.logger.error(`[Relauncher] Modification error: ${error.message}`);
        }
        return false;
    }

    /**
     * Windows: 使用 PowerShell 修改 .lnk 捷徑
     */
    private async modifyWindowsShortcut(): Promise<boolean> {
        const ideName = this.getIdeName();
        // PowerShell 腳本：查找並修改捷徑
        const script = `
$ErrorActionPreference = "SilentlyContinue"
$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [System.IO.Path]::Combine($env:USERPROFILE, "Desktop")
$StartMenuPath = [System.IO.Path]::Combine($env:APPDATA, "Microsoft", "Windows", "Start Menu", "Programs")

# 搜尋包含 IDE 名稱的捷徑
$Shortcuts = Get-ChildItem "$DesktopPath\\*.lnk", "$StartMenuPath\\*.lnk" -Recurse | Where-Object { $_.Name -like "*${ideName}*" }

$modified = $false
foreach ($file in $Shortcuts) {
    try {
        $shortcut = $WshShell.CreateShortcut($file.FullName)
        if ($shortcut.Arguments -notlike "*${CDP_FLAG}*") {
            # 將 CDP 參數加到最前面
            $shortcut.Arguments = "${CDP_FLAG} " + $shortcut.Arguments
            $shortcut.Save()
            $modified = $true
            Write-Output "Modified: $($file.FullName)"
        }
    } catch {
        Write-Output "Error modifying: $($file.FullName)"
    }
}
if ($modified) { Write-Output "MODIFIED_SUCCESS" } else { Write-Output "NO_CHANGE" }
`;
        const result = await this.runPowerShell(script);
        return result.includes('MODIFIED_SUCCESS');
    }

    /**
     * 重啟 IDE
     */
    private async relaunch(): Promise<void> {
        const folders = (vscode.workspace.workspaceFolders || []).map(f => `"${f.uri.fsPath}"`).join(' ');

        if (this.platform === 'win32') {
            const ideName = this.getIdeName();
            // Windows 重啟指令
            const cmd = `timeout /t 2 /nobreak >nul & start "" "${ideName}" ${folders}`;
            const child = cp.spawn('cmd.exe', ['/c', cmd], {
                detached: true,
                stdio: 'ignore'
            });
            child.unref();
        } else {
            // 其他平台 TODO
            this.logger.warn('[Relauncher] Relaunch not fully implemented for this platform.');
        }

        // 稍微延遲後關閉當前視窗
        setTimeout(() => {
            vscode.commands.executeCommand('workbench.action.quit');
        }, 500);
    }

    /**
     * 執行 PowerShell 腳本
     */
    private async runPowerShell(script: string): Promise<string> {
        return new Promise((resolve) => {
            try {
                const tempFile = path.join(os.tmpdir(), `relaunch_${Date.now()}.ps1`);
                fs.writeFileSync(tempFile, script, 'utf8');

                cp.exec(`powershell -ExecutionPolicy Bypass -File "${tempFile}"`, (error, stdout, stderr) => {
                    // 清理暫存檔
                    try { fs.unlinkSync(tempFile); } catch (e) { }

                    if (error) {
                        this.logger.error(`[Relauncher] PowerShell error: ${error.message}`);
                        resolve('');
                        return;
                    }
                    this.logger.debug(`[Relauncher] PowerShell output: ${stdout}`);
                    resolve(stdout);
                });
            } catch (e) {
                const error = e as Error;
                this.logger.error(`[Relauncher] PowerShell exec failed: ${error.message}`);
                resolve('');
            }
        });
    }
}
