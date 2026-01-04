/**
 * VS Code 測試設定檔
 * 
 * 用於 @vscode/test-cli
 */
import { defineConfig } from '@vscode/test-cli';

export default defineConfig([
    {
        label: 'unit',
        files: 'out/test/unit/**/*.test.js',
        version: 'stable',
        mocha: {
            ui: 'bdd',
            timeout: 10000
        }
    },
    {
        label: 'smoke',
        files: 'out/test/smoke/**/*.test.js',
        version: 'stable',
        mocha: {
            ui: 'tdd',
            timeout: 30000
        }
    },
    {
        label: 'e2e',
        files: 'out/test/e2e/**/*.test.js',
        version: 'stable',
        mocha: {
            ui: 'tdd',
            timeout: 60000
        }
    },
    {
        label: 'integration',
        files: 'out/test/integration/**/*.test.js',
        version: 'stable',
        mocha: {
            ui: 'tdd',
            timeout: 20000
        }
    }
]);
