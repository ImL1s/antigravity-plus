
import * as vscode from 'vscode';

/**
 * 等待擴充套件完全啟動
 * 
 * 解決 E2E 測試中 "command not registered" 的問題
 */
export async function waitForExtension(_timeoutMs = 10000): Promise<void> {
    const extension = vscode.extensions.getExtension('ImL1s.antigravity-plus');

    if (!extension) {
        throw new Error('Extension "ImL1s.antigravity-plus" not found');
    }

    // 如果已經啟動，等待一小段時間確保命令註冊完成
    if (extension.isActive) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return;
    }

    console.log('[E2E] Waiting for extension activation...');
    try {
        await extension.activate();
        console.log('[E2E] Extension activate() promise resolved.');
    } catch (e) {
        console.error('[E2E] Extension activation failed:', e);
        throw e;
    }

    // 啟動後額外等待，確保所有非同步註冊完成
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('[E2E] Extension activated fully.');
}
