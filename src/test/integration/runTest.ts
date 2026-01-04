/**
 * 整合測試運行腳本 (Integration Test Launcher)
 * 
 * 相較於 E2E，這不需要開 VS Code UI，只需要 Node.js 環境即可
 * 但因為我們的程式碼有 import 'vscode'，所以還是得用 @vscode/test-electron 跑
 */

import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main(): Promise<void> {
    try {
        const extensionDevelopmentPath = path.resolve(__dirname, '../../../');
        const extensionTestsPath = path.resolve(__dirname, './index');

        await runTests({
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs: [
                '--disable-extensions',
                '--disable-gpu'
            ]
        });
    } catch (err) {
        console.error('Failed to run integration tests:', err);
        process.exit(1);
    }
}

main();
