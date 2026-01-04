/**
 * E2E 測試：配額監控流程
 */

import * as assert from 'assert';
import * as vscode from 'vscode';

import { waitForExtension } from './test-utils';

suite('E2E Tests - Quota Monitor', () => {
    suiteSetup(async () => {
        await waitForExtension();
    });

    suite('刷新配額', () => {
        test('執行 refreshQuota 指令不應該報錯', async () => {
            try {
                await vscode.commands.executeCommand('antigravity-plus.refreshQuota');
                assert.ok(true, '指令執行成功');
            } catch (error) {
                assert.fail(`指令執行失敗: ${error}`);
            }
        });
    });

    suite('重置 Session', () => {
        test('執行 resetSession 指令不應該報錯', async () => {
            try {
                await vscode.commands.executeCommand('antigravity-plus.resetSession');
                assert.ok(true, '指令執行成功');
            } catch (error) {
                assert.fail(`指令執行失敗: ${error}`);
            }
        });
    });
});
