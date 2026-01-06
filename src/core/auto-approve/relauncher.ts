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
    private fs: typeof fs;
    private os: typeof os;
    private cp: typeof cp;

    constructor(private logger: Logger, deps?: { fs?: any, os?: any, cp?: any }) {
        this.fs = deps?.fs || fs;
        this.os = deps?.os || os;
        this.cp = deps?.cp || cp;
        this.platform = this.os.platform();
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
    /**
     * 修改啟動捷徑
     */
    private async modifyShortcut(): Promise<boolean> {
        try {
            if (this.platform === 'win32') {
                return await this.modifyWindowsShortcut();
            }
            if (this.platform === 'darwin') {
                return await this.modifyMacOSShortcut();
            }
            if (this.platform === 'linux') {
                return await this.modifyLinuxShortcut();
            }
        } catch (e) {
            const error = e as Error;
            this.logger.error(`[Relauncher] Modification error: ${error.message}`);
        }
        return false;
    }

    /**
     * macOS: 暫不支援永久修改 GUI，提供立即重啟或安裝 Shell Alias
     */
    private async modifyMacOSShortcut(): Promise<boolean> {
        // macOS App Signing 防止直接修改 Info.plist
        // 我們將依賴 "Relaunch Now" 功能 (使用 open 命令帶參數)
        // 或者是安裝 Shell Alias 以便從終端機啟動時自動帶參數
        this.logger.info('[Relauncher] macOS permanent GUI modification not supported automatically.');

        const choice = await vscode.window.showInformationMessage(
            'macOS 安全限制阻止自動修改 GUI 捷徑。您可以選擇 "立即參數重啟" 或 "安裝終端機 Alias (永久)"。',
            '立即重啟',
            '安裝終端機 Alias',
            '取消'
        );

        if (choice === '立即重啟') {
            await this.relaunch();
            return true;
        }

        if (choice === '安裝終端機 Alias') {
            const success = await this.setupMacOSAlias();
            if (success) {
                vscode.window.showInformationMessage('Alias 安裝成功！以後從終端機啟動將自動啟用 CDP。');
                return true;
            } else {
                vscode.window.showErrorMessage('Alias 安裝失敗。請手動檢查 ~/.zshrc 或 ~/.bash_profile。');
            }
        }

        return false;
    }

    /**
     * macOS: 設定 Shell Alias 以達成持久化 (針對 CLI 啟動)
     */
    private async setupMacOSAlias(): Promise<boolean> {
        try {
            const home = this.os.homedir();
            const zshrc = path.join(home, '.zshrc');
            const bashProfile = path.join(home, '.bash_profile');

            // 決定別名名稱 (code 或 cursor)
            const ideBinary = this.getIdeName().toLowerCase() === 'cursor' ? 'cursor' : 'code';
            const aliasLine = `\nalias ${ideBinary}='${ideBinary} ${CDP_FLAG}'\n`;

            let targetFile = '';
            if (this.fs.existsSync(zshrc)) {
                targetFile = zshrc;
            } else if (this.fs.existsSync(bashProfile)) {
                targetFile = bashProfile;
            } else {
                // 如果都沒有，預設建立一個 .zshrc (macOS 預設 shell 是 zsh)
                targetFile = zshrc;
            }

            this.logger.info(`[Relauncher] Attempting to add alias to ${targetFile}`);

            let content = '';
            if (this.fs.existsSync(targetFile)) {
                content = this.fs.readFileSync(targetFile, 'utf8');
            }

            if (content.includes(`alias ${ideBinary}=`)) {
                // 如果已有別名，替換之
                const lines = content.split('\n');
                const newLines = lines.map(line => {
                    if (line.trim().startsWith(`alias ${ideBinary}=`)) {
                        return `alias ${ideBinary}='${ideBinary} ${CDP_FLAG}'`;
                    }
                    return line;
                });
                this.fs.writeFileSync(targetFile, newLines.join('\n'), 'utf8');
            } else {
                // 否則追加
                this.fs.appendFileSync(targetFile, aliasLine, 'utf8');
            }

            return true;
        } catch (e) {
            const error = e as Error;
            this.logger.error(`[Relauncher] macOS Alias setup failed: ${error.message}`);
            return false;
        }
    }

    /**
     * Linux: 修改 .desktop 檔案
     */
    private async modifyLinuxShortcut(): Promise<boolean> {
        // const ideName = this.getIdeName(); // Unused in this scope
        // 常見的 .desktop 檔案名稱
        const candidates = [
            'code.desktop',
            'visual-studio-code.desktop',
            'code-oss.desktop',
            'cursor.desktop',
            `${vscode.env.appName}.desktop`.toLowerCase().replace(/\s+/g, '-')
        ];

        const userDir = path.join(this.os.homedir(), '.local', 'share', 'applications');
        const systemDirs = [
            '/usr/share/applications',
            '/var/lib/snapd/desktop/applications'
        ];

        // 確保用戶目錄存在
        if (!this.fs.existsSync(userDir)) {
            this.fs.mkdirSync(userDir, { recursive: true });
        }

        let targetFile = '';
        let sourceFile = '';

        // 1. 檢查用戶目錄是否已有檔案
        for (const name of candidates) {
            const p = path.join(userDir, name);
            if (this.fs.existsSync(p)) {
                targetFile = p;
                sourceFile = p;
                break;
            }
        }

        // 2. 如果用戶目錄沒有，找系統目錄
        if (!targetFile) {
            for (const dir of systemDirs) {
                for (const name of candidates) {
                    const p = path.join(dir, name);
                    if (this.fs.existsSync(p)) {
                        sourceFile = p;
                        targetFile = path.join(userDir, name); // 複製目標
                        break;
                    }
                }
                if (sourceFile) break;
            }
        }

        if (!sourceFile) {
            this.logger.error('[Relauncher] No suitable .desktop file found.');
            return false;
        }

        try {
            this.logger.info(`[Relauncher] Reading from ${sourceFile}`);
            const content = this.fs.readFileSync(sourceFile, 'utf8');

            // 修改 Exec 行
            // 匹配 Exec=... 且不包含我們參數的行
            const lines = content.split('\n');
            let modified = false;
            const newLines = lines.map(line => {
                if (line.startsWith('Exec=') && !line.includes(CDP_FLAG)) {
                    // 在 Exec=code %F 或類似結構中插入參數
                    // 通常放在指令之後，參數之前
                    // 簡單解法：直接 append 到 command 後面，但在 %F 等佔位符之前

                    // 尋找命令結束位置 (通常是第一個空格，但路徑可能有空格)
                    // 更安全的做法：直接加在 %F, %U, %f 等與參數相關的佔位符之前
                    // 或者直接加在行尾 (有些實作可能會有問題，但通常可行)

                    // 策略：如果有點位符，插在佔位符前；如果沒有，插在行尾
                    const placeholders = ['%F', '%f', '%U', '%u'];
                    let inserted = false;
                    for (const ph of placeholders) {
                        if (line.includes(ph)) {
                            line = line.replace(ph, `${CDP_FLAG} ${ph}`);
                            inserted = true;
                            break;
                        }
                    }
                    if (!inserted) {
                        line = line + ` ${CDP_FLAG}`;
                    }
                    modified = true;
                    this.logger.info(`[Relauncher] Modified Exec line: ${line}`);
                }
                return line;
            });

            if (modified) {
                this.fs.writeFileSync(targetFile, newLines.join('\n'), 'utf8');
                this.logger.info(`[Relauncher] Written modified .desktop to ${targetFile}`);

                // 更新 desktop database
                this.cp.exec('update-desktop-database ' + userDir, (err) => {
                    if (err) this.logger.warn(`[Relauncher] update-desktop-database failed: ${err.message}`);
                });

                return true;
            }

            this.logger.info('[Relauncher] .desktop file already contains the flag.');
            return true; // 視為成功
        } catch (e) {
            const error = e as Error;
            this.logger.error(`[Relauncher] Linux modification failed: ${error.message}`);
            return false;
        }
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
            const cmd = `timeout /t 2 /nobreak >nul & start "" "${ideName}" ${folders}`;
            const child = this.cp.spawn('cmd.exe', ['/c', cmd], {
                detached: true,
                stdio: 'ignore'
            });
            child.unref();
        } else if (this.platform === 'darwin') {
            // macOS: 使用 open -n -a "Application Name" --args ...
            // const appPath = process.execPath; // Typically /Applications/Visual Studio Code.app/Contents/MacOS/Electron
            // 我們需要找到 .app bundle 路徑
            // process.execPath: .../Visual Studio Code.app/Contents/MacOS/Electron
            // 目標: .../Visual Studio Code.app

            // 簡單策略：嘗試從 process.execPath 推導，或使用 "Visual Studio Code" 名稱
            // 使用名稱最簡單，但如果是 Insiders 或 Cursor 會不同
            let appName = 'Visual Studio Code';
            if (vscode.env.appName.includes('Insiders')) appName = 'Visual Studio Code - Insiders';
            if (vscode.env.appName.includes('Cursor')) appName = 'Cursor';

            this.logger.info(`[Relauncher] Relaunching ${appName} on macOS...`);

            const args = ['-n', '-a', appName, '--args', '--remote-debugging-port=' + CDP_PORT];
            if (folders) {
                // open 命令不直接接受資料夾作為 --args，而是作為 open 的參數
                // open -n -a "VS Code" <folders> --args ...
                // 注意：放在 --args 之後的參數會傳給 app，放在之前的傳給 open
                // 資料夾應該是 open 的參數
                // 正確格式: open -n -a "VS Code" --args ... (VS Code 可能需要資料夾作為參數傳給它)

                // VS Code 特定： code --remote-... <folder>
                // 所以 <folder> 應該在 --args 之後
                args.push(folders.replace(/"/g, '')); // 移除引號，spawn 會處理
            }

            const child = this.cp.spawn('open', args, {
                detached: true,
                stdio: 'ignore'
            });
            child.unref();

        } else if (this.platform === 'linux') {
            // Linux: 嘗試直接執行 executable 或使用 gtk-launch
            // process.execPath 指向二進制文件
            const exe = process.execPath;
            const args = [CDP_FLAG];
            if (folders) {
                args.push(folders.replace(/"/g, ''));
            }

            this.logger.info(`[Relauncher] Relaunching on Linux: ${exe} ${args.join(' ')}`);

            const child = this.cp.spawn(exe, args, {
                detached: true,
                stdio: 'ignore'
            });
            child.unref();
        }

        // 稍微延遲後關閉當前視窗
        setTimeout(() => {
            vscode.commands.executeCommand('workbench.action.quit');
        }, 1000);
    }

    /**
     * 執行 PowerShell 腳本
     */
    private async runPowerShell(script: string): Promise<string> {
        return new Promise((resolve) => {
            try {
                const tempFile = path.join(this.os.tmpdir(), `relaunch_${Date.now()}.ps1`);
                this.fs.writeFileSync(tempFile, script, 'utf8');

                this.cp.exec(`powershell -ExecutionPolicy Bypass -File "${tempFile}"`, (error, stdout, stderr) => {
                    // 清理暫存檔
                    try { this.fs.unlinkSync(tempFile); } catch { /* ignore cleanup errors */ }

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
