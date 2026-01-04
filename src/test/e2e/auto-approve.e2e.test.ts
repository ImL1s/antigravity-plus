/**
 * E2E 測試：自動核准流程
 */

import * as assert from 'assert';
import * as vscode from 'vscode';

suite('E2E Tests - Auto Approve', () => {
    suiteSetup(async () => {
        const extension = vscode.extensions.getExtension('ImL1s.antigravity-plus');
        if (extension && !extension.isActive) {
            await extension.activate();
        }
        // 等待擴展完全啟動
        await new Promise(resolve => setTimeout(resolve, 1000));
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
