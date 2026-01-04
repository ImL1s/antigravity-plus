/**
 * E2E 測試：自動核准流程
 */

import * as assert from 'assert';
import * as vscode from 'vscode';

import { waitForExtension } from './test-utils';

suite('E2E Tests - Auto Approve', () => {
    suiteSetup(async () => {
        await waitForExtension();
    });

    suite('切換自動核准', () => {
        test('執行 toggleAutoApprove 指令不應該報錯', async () => {
            try {
                await vscode.commands.executeCommand('antigravity-plus.toggleAutoApprove');
                assert.ok(true, '指令執行成功');
            } catch (error) {
                assert.fail(`指令執行失敗: ${error}`);
            }
        });
    });
});
