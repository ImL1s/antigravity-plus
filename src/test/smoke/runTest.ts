/**
 * 冒煙測試運行腳本
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
        console.error('Failed to run smoke tests:', err);
        process.exit(1);
    }
}

main();
