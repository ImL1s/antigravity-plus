/**
 * E2E 測試：Dashboard UI
 */

import * as assert from 'assert';
import * as vscode from 'vscode';

import { waitForExtension } from './test-utils';

suite('E2E Tests - Dashboard', () => {
    suiteSetup(async () => {
        await waitForExtension();
    });

    suite('開啟 Dashboard', () => {
        test('執行 openDashboard 指令不應該報錯', async () => {
            try {
                await vscode.commands.executeCommand('antigravity-plus.openDashboard');
                await new Promise(resolve => setTimeout(resolve, 500));
                assert.ok(true, 'Dashboard 開啟指令執行成功');
            } catch (error) {
                assert.fail(`Dashboard 開啟失敗: ${error}`);
            }
        });
    });

    suite('顯示日誌', () => {
        test('執行 showLogs 指令不應該報錯', async () => {
            try {
                await vscode.commands.executeCommand('antigravity-plus.showLogs');
                assert.ok(true, '日誌顯示成功');
            } catch (error) {
                assert.fail(`日誌顯示失敗: ${error}`);
            }
        });
    });
});
