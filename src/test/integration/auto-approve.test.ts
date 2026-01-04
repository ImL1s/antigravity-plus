
import * as assert from 'assert';
import * as vscode from 'vscode';
import { AutoApproveController } from '../../core/auto-approve/controller';
import { ConfigManager } from '../../utils/config';
import { Logger } from '../../utils/logger';

// Mock Logger
class MockLogger {
    private outputChannel: any = {
        appendLine: () => { },
        show: () => { },
        dispose: () => { }
    };

    debug(msg: string): void { console.log(`[MockLogger] DEBUG: ${msg}`); }
    info(msg: string): void { console.log(`[MockLogger] INFO: ${msg}`); }
    warn(msg: string): void { console.log(`[MockLogger] WARN: ${msg}`); }
    error(msg: string): void { console.error(`[MockLogger] ERROR: ${msg}`); }
    showOutputChannel(): void { }
    dispose(): void { }
}

// Mock CDPManager
class MockCDPManager {
    dispose() { }
    async tryConnectAndInject(_config?: any): Promise<boolean> { return true; }
}

// Testable subclass to capture commands
class TestableAutoApproveController extends AutoApproveController {
    public commandCalls: string[] = [];

    protected async runCommand(command: string, ..._args: any[]): Promise<any> {
        this.commandCalls.push(command);
        return undefined; // Don't actually execute during test
    }
}

suite('Auto Approve Integration Tests', () => {
    let controller: TestableAutoApproveController;
    let configManager: ConfigManager;
    let logger: Logger;

    setup(() => {
        logger = new MockLogger() as unknown as Logger;
        configManager = new ConfigManager();

        const context = {
            subscriptions: [],
            extensionPath: '',
            storagePath: '',
            globalStoragePath: '',
            logPath: '',
            asAbsolutePath: (p: string) => p,
            globalState: {
                get: (_key: string) => undefined,
                update: (_key: string, _value: any) => Promise.resolve(),
                keys: () => []
            },
            workspaceState: {
                get: (_key: string) => undefined,
                update: (_key: string, _value: any) => Promise.resolve(),
                keys: () => []
            }
        } as unknown as vscode.ExtensionContext;

        const mockCdp = new MockCDPManager() as unknown as any;
        controller = new TestableAutoApproveController(context, logger, configManager, mockCdp);
    });

    teardown(() => {
        if (controller) controller.dispose();
    });

    test('Controller should initialize', () => {
        assert.ok(controller);
    });

    test('Pesosz Strategy should invoke expected internal commands', async () => {
        controller.enable();
        await (controller as any).poll();

        const hasAgentAccept = controller.commandCalls.includes('antigravity.agent.acceptAgentStep');
        const hasTerminalAccept = controller.commandCalls.includes('antigravity.terminal.accept');

        assert.ok(hasAgentAccept, 'Should call antigravity.agent.acceptAgentStep');
        assert.ok(hasTerminalAccept, 'Should call antigravity.terminal.accept');
    });
});
