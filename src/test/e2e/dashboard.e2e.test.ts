/**
 * E2E 測試：Dashboard UI
 */

import * as assert from 'assert';
import * as vscode from 'vscode';

import { waitForExtension } from './test-utils';

describe('E2E Tests - Dashboard', () => {
    before(async () => {
        await waitForExtension();
    });

    describe('開啟 Dashboard', () => {
        it('執行 openDashboard 指令不應該報錯', async () => {
            try {
                await vscode.commands.executeCommand('antigravity-plus.openDashboard');
                await new Promise(resolve => setTimeout(resolve, 500));
                assert.ok(true, 'Dashboard 開啟指令執行成功');
            } catch (error) {
                assert.fail(`Dashboard 開啟失敗: ${error}`);
            }
        });
    });

    describe('顯示日誌', () => {
        it('執行 showLogs 指令不應該報錯', async () => {
            try {
                await vscode.commands.executeCommand('antigravity-plus.showLogs');
                assert.ok(true, '日誌顯示成功');
            } catch (error) {
                assert.fail(`日誌顯示失敗: ${error}`);
            }
        });
    });

    describe('Context Optimizer', () => {
        it('執行 optimizeContext 指令不應該報錯', async () => {
            try {
                await vscode.commands.executeCommand('antigravity-plus.optimizeContext');
                await new Promise(resolve => setTimeout(resolve, 500));
                assert.ok(true, 'Context Optimizer 執行成功');
            } catch (error) {
                assert.fail(`Context Optimizer 執行失敗: ${error}`);
            }
        });
    });
});
