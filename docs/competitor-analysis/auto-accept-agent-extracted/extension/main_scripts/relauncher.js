const vscode = require('vscode');
const { execSync, spawn } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

const CDP_PORT = 9000;
const CDP_FLAG = `--remote-debugging-port=${CDP_PORT}`;

/**
 * Robust cross-platform manager for IDE shortcuts and relaunching
 */
class Relauncher {
    constructor(logger = console.log) {
        this.platform = os.platform();
        this.logger = logger;
    }

    log(msg) {
        this.logger(`[Relauncher] ${msg}`);
    }

    /**
     * Get the human-readable name of the IDE (Cursor, Antigravity, VS Code)
     */
    getIdeName() {
        const appName = vscode.env.appName || '';
        if (appName.toLowerCase().includes('cursor')) return 'Cursor';
        if (appName.toLowerCase().includes('antigravity')) return 'Antigravity';
        return 'Code';
    }

    /**
     * Main entry point: ensures CDP is enabled and relaunches if necessary
     */
    async ensureCDPAndRelaunch() {
        this.log('Checking shortcut for CDP flag...');
        const hasFlag = await this.checkShortcutFlag();

        if (hasFlag) {
            this.log('CDP flag already present in shortcut.');
            return { success: true, relaunched: false };
        }

        this.log('CDP flag missing. Attempting to modify shortcut...');
        const modified = await this.modifyShortcut();

        if (modified) {
            this.log('Shortcut modified successfully. Prompting for restart...');
            const choice = await vscode.window.showInformationMessage(
                'Auto Accept requires a quick restart to enable background mode. Restart now?',
                'Restart', 'Later'
            );

            if (choice === 'Restart') {
                await this.relaunch();
                return { success: true, relaunched: true };
            }
        } else {
            this.log('Failed to modify shortcut automatically.');
            vscode.window.showErrorMessage('Auto Accept: Could not enable background mode automatically. Please add --remote-debugging-port=9000 to your IDE shortcut manually.');
        }

        return { success: false, relaunched: false };
    }

    /**
     * Platform-specific check if the current launch shortcut has the flag
     */
    async checkShortcutFlag() {
        // Optimization: checking the process arguments of the current instance
        // This is the most reliable way to know if WE were launched with it
        const args = process.argv.join(' ');
        return args.includes('--remote-debugging-port=9000');
    }

    /**
     * Modify the primary launch shortcut for the current platform
     */
    async modifyShortcut() {
        try {
            if (this.platform === 'win32') return await this._modifyWindowsShortcut();
            if (this.platform === 'darwin') return await this._modifyMacOSShortcut();
            if (this.platform === 'linux') return await this._modifyLinuxShortcut();
        } catch (e) {
            this.log(`Modification error: ${e.message}`);
        }
        return false;
    }

    async _modifyWindowsShortcut() {
        const ideName = this.getIdeName();
        const script = `
$ErrorActionPreference = "SilentlyContinue"
$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [System.IO.Path]::Combine($env:USERPROFILE, "Desktop")
$StartMenuPath = [System.IO.Path]::Combine($env:APPDATA, "Microsoft", "Windows", "Start Menu", "Programs")

$Shortcuts = Get-ChildItem "$DesktopPath\\*.lnk", "$StartMenuPath\\*.lnk" -Recurse | Where-Object { $_.Name -like "*${ideName}*" }

$modified = $false
foreach ($file in $Shortcuts) {
    try {
        $shortcut = $WshShell.CreateShortcut($file.FullName)
        if ($shortcut.Arguments -notlike "*--remote-debugging-port=9000*") {
            $shortcut.Arguments = "--remote-debugging-port=9000 " + $shortcut.Arguments
            $shortcut.Save()
            $modified = $true
        }
    } catch {}
}
if ($modified) { Write-Output "MODIFIED" } else { Write-Output "NO_CHANGE" }
`;
        const result = this._runPowerShell(script);
        return result.includes('MODIFIED');
    }

    async _modifyMacOSShortcut() {
        const ideName = this.getIdeName();
        const binDir = path.join(os.homedir(), '.local', 'bin');
        const wrapperPath = path.join(binDir, `${ideName.toLowerCase()}-cdp`);

        if (!fs.existsSync(binDir)) fs.mkdirSync(binDir, { recursive: true });

        const appPath = this.getIdeName() === 'Code' ? '/Applications/Visual Studio Code.app' : `/Applications/${ideName}.app`;
        const content = `#!/bin/bash\nopen -a "${appPath}" --args --remote-debugging-port=9000 "$@"`;

        fs.writeFileSync(wrapperPath, content, { mode: 0o755 });
        this.log(`Created macOS wrapper at ${wrapperPath}`);
        return true; // We consider creation a success
    }

    async _modifyLinuxShortcut() {
        const ideName = this.getIdeName().toLowerCase();
        const desktopPaths = [
            path.join(os.homedir(), '.local', 'share', 'applications', `${ideName}.desktop`),
            `/usr/share/applications/${ideName}.desktop`
        ];

        for (const p of desktopPaths) {
            if (fs.existsSync(p)) {
                let content = fs.readFileSync(p, 'utf8');
                if (!content.includes('--remote-debugging-port=9000')) {
                    content = content.replace(/^Exec=(.*)$/m, 'Exec=$1 --remote-debugging-port=9000');
                    const userPath = path.join(os.homedir(), '.local', 'share', 'applications', path.basename(p));
                    fs.mkdirSync(path.dirname(userPath), { recursive: true });
                    fs.writeFileSync(userPath, content);
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Relaunch the IDE using the modified shortcut/wrapper
     */
    async relaunch() {
        const folders = (vscode.workspace.workspaceFolders || []).map(f => `"${f.uri.fsPath}"`).join(' ');

        if (this.platform === 'win32') {
            const ideName = this.getIdeName();
            const cmd = `timeout /t 2 /nobreak >nul & start "" "${ideName}" ${folders}`;
            spawn('cmd.exe', ['/c', cmd], { detached: true, stdio: 'ignore' }).unref();
        } else if (this.platform === 'darwin') {
            const ideName = this.getIdeName();
            const wrapperPath = path.join(os.homedir(), '.local', 'bin', `${ideName.toLowerCase()}-cdp`);
            const cmd = `sleep 2 && "${wrapperPath}" ${folders}`;
            spawn('sh', ['-c', cmd], { detached: true, stdio: 'ignore' }).unref();
        } else {
            const cmd = `sleep 2 && ${this.getIdeName().toLowerCase()} --remote-debugging-port=9000 ${folders}`;
            spawn('sh', ['-c', cmd], { detached: true, stdio: 'ignore' }).unref();
        }

        setTimeout(() => vscode.commands.executeCommand('workbench.action.quit'), 500);
    }

    _runPowerShell(script) {
        try {
            const tempFile = path.join(os.tmpdir(), `relaunch_${Date.now()}.ps1`);
            fs.writeFileSync(tempFile, script, 'utf8');
            const result = execSync(`powershell -ExecutionPolicy Bypass -File "${tempFile}"`, { encoding: 'utf8' });
            fs.unlinkSync(tempFile);
            return result;
        } catch (e) {
            return '';
        }
    }
}

module.exports = { Relauncher };
