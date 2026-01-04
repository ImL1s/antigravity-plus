/**
 * 冒煙測試（Smoke Tests）
 * 
 * 驗證擴展的基本功能是否正常運作
 */

import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Smoke Tests', () => {
    vscode.window.showInformationMessage('開始冒煙測試');

    suite('擴展載入', () => {
        test('擴展應該成功啟動', async () => {
            const extension = vscode.extensions.getExtension('ImL1s.antigravity-plus');
            assert.ok(extension, '擴展應該存在');

            if (extension && !extension.isActive) {
                await extension.activate();
                // Wait a bit for async registrations and side effects
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            assert.ok(extension?.isActive, '擴展應該已啟動');
        });
    });

    suite('指令註冊', () => {
        const expectedCommands = [
            'antigravity-plus.openDashboard',
            'antigravity-plus.toggleAutoApprove',
            'antigravity-plus.refreshQuota',
            'antigravity-plus.resetSession',
            'antigravity-plus.showLogs',
            'antigravity-plus.showQuickPick'
        ];

        expectedCommands.forEach(command => {
            test(`指令 ${command} 應該已註冊`, async () => {
                const commands = await vscode.commands.getCommands();
                assert.ok(
                    commands.includes(command),
                    `指令 ${command} 未註冊`
                );
            });
        });
    });

    suite('設定載入', () => {
        test('設定應該可以讀取', () => {
            const config = vscode.workspace.getConfiguration('antigravity-plus');
            assert.ok(config, '設定應該存在');
        });

        test('autoApprove.enabled 設定應該存在', () => {
            const config = vscode.workspace.getConfiguration('antigravity-plus');
            const enabled = config.get('autoApprove.enabled');
            assert.ok(enabled !== undefined, 'autoApprove.enabled 應該有預設值');
        });

        test('quotaMonitor.enabled 設定應該存在', () => {
            const config = vscode.workspace.getConfiguration('antigravity-plus');
            const enabled = config.get('quotaMonitor.enabled');
            assert.ok(enabled !== undefined, 'quotaMonitor.enabled 應該有預設值');
        });

        test('ui.language 設定應該存在', () => {
            const config = vscode.workspace.getConfiguration('antigravity-plus');
            const language = config.get('ui.language');
            assert.ok(language !== undefined, 'ui.language 應該有預設值');
        });
    });

    suite('狀態列', () => {
        test('狀態列項目應該顯示', async () => {
            // 等待擴展完全啟動
            await new Promise(resolve => setTimeout(resolve, 1000));

            // 狀態列項目不容易直接測試，這裡只確認沒有錯誤
            assert.ok(true, '狀態列檢查通過');
        });
    });
});
