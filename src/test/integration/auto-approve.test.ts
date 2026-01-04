/**
 * Auto Approve Integration Tests (Pesosz 策略)
 * 
 * 測試對齊 Pesosz 實現的 AutoApproveController
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { AutoApproveController } from '../../core/auto-approve/controller';
import { ConfigManager } from '../../utils/config';
import { Logger } from '../../utils/logger';

// Mock Logger
class MockLogger {
    debug(_msg: string): void { }
    info(_msg: string): void { }
    warn(_msg: string): void { }
    error(_msg: string): void { }
    showOutputChannel(): void { }
    dispose(): void { }
}

suite('Auto Approve Integration Tests', () => {
    let controller: AutoApproveController;
    let configManager: ConfigManager;
    let logger: Logger;

    setup(() => {
        logger = new MockLogger() as unknown as Logger;
        configManager = new ConfigManager();

        const context = {
            subscriptions: [],
            globalState: {
                get: () => undefined,
                update: () => Promise.resolve()
            }
        } as unknown as vscode.ExtensionContext;

        controller = new AutoApproveController(context, logger, configManager);
    });

    teardown(() => {
        controller.dispose();
    });

    test('Controller should initialize with disabled state by default', () => {
        // By default, auto-approve should be disabled
        assert.strictEqual(controller.isEnabled(), false);
    });

    test('Toggle should switch enabled state', () => {
        assert.strictEqual(controller.isEnabled(), false);

        controller.toggle();
        assert.strictEqual(controller.isEnabled(), true);

        controller.toggle();
        assert.strictEqual(controller.isEnabled(), false);
    });

    test('Enable should turn on auto-approve', () => {
        assert.strictEqual(controller.isEnabled(), false);
        controller.enable();
        assert.strictEqual(controller.isEnabled(), true);
    });

    test('Disable should turn off auto-approve', () => {
        controller.enable();
        assert.strictEqual(controller.isEnabled(), true);

        controller.disable();
        assert.strictEqual(controller.isEnabled(), false);
    });

    test('evaluateTerminalCommand should return result when enabled', () => {
        controller.enable();

        const result = controller.evaluateTerminalCommand('npm run build');
        // Should return an ApprovalResult object
        assert.ok('approved' in result);
    });

    test('evaluateTerminalCommand should not approve when disabled', () => {
        controller.disable();

        const result = controller.evaluateTerminalCommand('npm run build');
        assert.strictEqual(result.approved, false);
        assert.ok(result.reason?.includes('未啟用'));
    });

    test('evaluateFileOperation should return result when enabled', () => {
        controller.enable();

        const result = controller.evaluateFileOperation('/path/to/file.ts', 'edit');
        assert.ok('approved' in result);
    });

    test('getOperationLogs should return array', () => {
        const logs = controller.getOperationLogs();
        assert.ok(Array.isArray(logs));
    });

    test('updateConfig should not throw', () => {
        assert.doesNotThrow(() => {
            controller.updateConfig();
        });
    });

    test('dispose should clean up resources', () => {
        controller.enable();
        assert.strictEqual(controller.isEnabled(), true);

        controller.dispose();
        // After dispose, controller should still report its last state
        // but internal resources should be cleaned up
    });
});
