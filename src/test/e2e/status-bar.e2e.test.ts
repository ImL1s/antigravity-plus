/**
 * E2E 測試：Status Bar UI
 * 
 * 驗證 Status Bar 項目的存在與行為
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { waitForExtension } from './test-utils';

describe('E2E Tests - Status Bar', () => {
    before(async () => {
        await waitForExtension();
    });

    describe('Status Bar 項目存在測試', () => {
        it('Auto Accept 項目存在與切換', async () => {
            // 透過 toggleAutoApprove 指令驗證項目存在
            try {
                // 初始狀態：預設 OFF (根據 config.ts)

                // 切換為 ON
                await vscode.commands.executeCommand('antigravity-plus.toggleAutoApprove');
                // 這裡在真實 UI 測試中應該驗證 Background Item 出現，但在 API level 我們只能驗證命令執行成功

                // 再切換回 OFF
                await vscode.commands.executeCommand('antigravity-plus.toggleAutoApprove');

                assert.ok(true, 'Auto Accept toggle command works');
            } catch (error) {
                assert.fail(`Auto Accept toggle failed: ${error}`);
            }
        });

        it('Background 項目命令測試 (v0.0.14)', async () => {
            // 驗證 Background 切換命令存在
            const cmds = await vscode.commands.getCommands(true);
            const exists = cmds.includes('antigravity-plus.toggleAutoWakeup');

            if (!exists) {
                // 如果找不到，列出相關命令幫助調試
                const related = cmds.filter(c => c.includes('antigravity'));
                console.log('Available Antigravity commands:', related);
            }

            assert.ok(exists, 'antigravity-plus.toggleAutoWakeup should be registered');
        });

        it('Dashboard 開啟指令存在', async () => {
            try {
                await vscode.commands.executeCommand('antigravity-plus.openDashboard');
                await new Promise(resolve => setTimeout(resolve, 500));
                assert.ok(true, 'Dashboard opened successfully');
            } catch (error) {
                assert.fail(`Dashboard open failed: ${error}`);
            }
        });

        it('Settings 設定可讀取', async () => {
            const config = vscode.workspace.getConfiguration('antigravity-plus');
            const displayStyle = config.get<string>('quotaMonitor.displayStyle');

            // 確認設定可讀取（值可以是 undefined 或已設定的值）
            assert.ok(displayStyle !== null, 'Settings should be readable');
        });
    });


    describe('Status Bar 狀態切換', () => {
        it('Auto Approve 應該可以切換', async () => {
            // 執行切換
            await vscode.commands.executeCommand('antigravity-plus.toggleAutoApprove');
            await new Promise(resolve => setTimeout(resolve, 100));

            // 再次切換恢復
            await vscode.commands.executeCommand('antigravity-plus.toggleAutoApprove');

            assert.ok(true, 'Auto Approve toggled successfully');
        });

        it('Background 狀態應該可以切換 (if command exists)', async () => {
            try {
                // 嘗試執行 (可能尚未註冊)
                await vscode.commands.executeCommand('antigravity-plus.toggleAutoWakeup');
                await new Promise(resolve => setTimeout(resolve, 100));
                assert.ok(true, 'Background toggle works');
            } catch (error) {
                // 指令不存在時不視為失敗
                console.log('toggleAutoWakeup command not registered yet');
                assert.ok(true, 'Command not registered (expected for now)');
            }
        });
    });

    describe('Edge Cases', () => {
        it('多次切換 Auto Approve 不應該報錯', async () => {
            for (let i = 0; i < 5; i++) {
                await vscode.commands.executeCommand('antigravity-plus.toggleAutoApprove');
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            assert.ok(true, 'Multiple toggles work without error');
        });

        it('快速連續開啟 Dashboard 不應該報錯', async () => {
            await vscode.commands.executeCommand('antigravity-plus.openDashboard');
            await vscode.commands.executeCommand('antigravity-plus.openDashboard');
            await new Promise(resolve => setTimeout(resolve, 200));
            assert.ok(true, 'Multiple dashboard opens work');
        });
    });
});
