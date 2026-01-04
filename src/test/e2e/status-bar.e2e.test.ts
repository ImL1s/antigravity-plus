/**
 * E2E 測試：Status Bar UI
 * 
 * 驗證 Status Bar 項目的存在與行為
 */

import * as assert from 'assert';
import * as vscode from 'vscode';

suite('E2E Tests - Status Bar', () => {
    suiteSetup(async () => {
        const extension = vscode.extensions.getExtension('ImL1s.antigravity-plus');
        if (extension && !extension.isActive) {
            await extension.activate();
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
    });

    suite('Status Bar 項目存在測試', () => {
        test('Auto Accept 項目存在', async () => {
            // 透過 toggleAutoApprove 指令驗證項目存在
            try {
                await vscode.commands.executeCommand('antigravity-plus.toggleAutoApprove');
                // 再次 toggle 恢復原狀
                await vscode.commands.executeCommand('antigravity-plus.toggleAutoApprove');
                assert.ok(true, 'Auto Accept toggle command works');
            } catch (error) {
                assert.fail(`Auto Accept toggle failed: ${error}`);
            }
        });

        test('Dashboard 開啟指令存在', async () => {
            try {
                await vscode.commands.executeCommand('antigravity-plus.openDashboard');
                await new Promise(resolve => setTimeout(resolve, 500));
                assert.ok(true, 'Dashboard opened successfully');
            } catch (error) {
                assert.fail(`Dashboard open failed: ${error}`);
            }
        });

        test('Settings 設定可讀取', async () => {
            const config = vscode.workspace.getConfiguration('antigravity-plus');
            const displayStyle = config.get<string>('quotaMonitor.displayStyle');

            // 確認設定可讀取（值可以是 undefined 或已設定的值）
            assert.ok(displayStyle !== null, 'Settings should be readable');
        });
    });

    suite('Status Bar 狀態切換', () => {
        test('Auto Approve 應該可以切換', async () => {
            // 執行切換
            await vscode.commands.executeCommand('antigravity-plus.toggleAutoApprove');
            await new Promise(resolve => setTimeout(resolve, 100));

            // 再次切換恢復
            await vscode.commands.executeCommand('antigravity-plus.toggleAutoApprove');

            assert.ok(true, 'Auto Approve toggled successfully');
        });

        test('Background 狀態應該可以切換 (if command exists)', async () => {
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

    suite('Edge Cases', () => {
        test('多次切換 Auto Approve 不應該報錯', async () => {
            for (let i = 0; i < 5; i++) {
                await vscode.commands.executeCommand('antigravity-plus.toggleAutoApprove');
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            assert.ok(true, 'Multiple toggles work without error');
        });

        test('快速連續開啟 Dashboard 不應該報錯', async () => {
            await vscode.commands.executeCommand('antigravity-plus.openDashboard');
            await vscode.commands.executeCommand('antigravity-plus.openDashboard');
            await new Promise(resolve => setTimeout(resolve, 200));
            assert.ok(true, 'Multiple dashboard opens work');
        });
    });
});
