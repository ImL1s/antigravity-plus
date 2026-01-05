/**
 * E2E 測試：配額監控流程
 */

import * as assert from 'assert';
import * as vscode from 'vscode';

import { waitForExtension } from './test-utils';

describe('E2E Tests - Quota Monitor', () => {
    before(async () => {
        await waitForExtension();
    });

    describe('刷新配額', () => {
        it('執行 refreshQuota 指令不應該報錯', async () => {
            try {
                await vscode.commands.executeCommand('antigravity-plus.refreshQuota');
                assert.ok(true, '指令執行成功');
            } catch (error) {
                assert.fail(`指令執行失敗: ${error}`);
            }
        });
    });

    describe('重置 Session', () => {
        it('執行 resetSession 指令不應該報錯', async () => {
            try {
                await vscode.commands.executeCommand('antigravity-plus.resetSession');
                assert.ok(true, '指令執行成功');
            } catch (error) {
                assert.fail(`指令執行失敗: ${error}`);
            }
        });
    });
});
