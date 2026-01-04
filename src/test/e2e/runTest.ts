/**
 * E2E 測試運行腳本
 * 
 * 使用 @vscode/test-electron 在真實 VS Code 環境中執行測試
 */

import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main(): Promise<void> {
    try {
        // 擴展開發目錄
        const extensionDevelopmentPath = path.resolve(__dirname, '../../../');

        // 測試運行器路徑
        const extensionTestsPath = path.resolve(__dirname, './index');

        // 下載 VS Code，解壓縮，並在測試中運行
        await runTests({
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs: [
                '--disable-extensions', // 禁用其他擴展
                '--disable-gpu'         // 禁用 GPU（CI 環境）
            ]
        });
    } catch (err) {
        console.error('Failed to run tests:', err);
        process.exit(1);
    }
}

main();
