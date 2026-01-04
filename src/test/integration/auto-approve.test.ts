
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

    debug(message: string): void { }
    info(message: string): void { }
    warn(message: string): void { }
    error(message: string): void { }
    showOutputChannel(): void { }
    dispose(): void { }
}

// Mock CDPManager
class MockCDPManager {
    dispose() { }
    async tryConnectAndInject(config?: any): Promise<boolean> { return true; }
}

suite('Auto Approve Integration Tests', () => {
    let controller: AutoApproveController;
    let configManager: ConfigManager;
    let logger: Logger;
    let originalExecuteCommand: any;
    let commandCalls: string[] = [];

    setup(() => {
        console.log('Test Setup: Start');
        logger = new MockLogger() as unknown as Logger;
        console.log('Test Setup: Logger created');
        configManager = new ConfigManager();
        console.log('Test Setup: ConfigManager created');

        // Manual Spy on vscode.commands.executeCommand
        originalExecuteCommand = vscode.commands.executeCommand;
        commandCalls = [];
        (vscode.commands as any).executeCommand = async (command: string, ...args: any[]) => {
            commandCalls.push(command);
            // Don't actually execute potentially missing commands to avoid errors
            if (command.startsWith('antigravity.')) {
                return undefined;
            }
            return originalExecuteCommand.call(vscode.commands, command, ...args);
        };

        const context = {
            subscriptions: [],
            extensionPath: '',
            storagePath: '',
            globalStoragePath: '',
            logPath: '',
            asAbsolutePath: (p: string) => p,
            globalState: {
                get: (key: string) => undefined,
                update: (key: string, value: any) => Promise.resolve(),
                keys: () => []
            },
            workspaceState: {
                get: (key: string) => undefined,
                update: (key: string, value: any) => Promise.resolve(),
                keys: () => []
            }
        } as unknown as vscode.ExtensionContext;

        const mockCdp = new MockCDPManager() as unknown as any;
        console.log('Test Setup: Creating Controller');
        controller = new AutoApproveController(context, logger as unknown as Logger, configManager, mockCdp);
        console.log('Test Setup: Controller created');
    });

    teardown(() => {
        if (controller) controller.dispose();
        // Restore spy
        (vscode.commands as any).executeCommand = originalExecuteCommand;
    });

    test('Controller should initialize', () => {
        assert.ok(controller);
    });

    test('Pesosz Strategy should invoke expected internal commands', async () => {
        // Manually trigger polling logic via type assertion
        // We need to ensure logic thinks strategy is 'pesosz'
        // Since we can't easily mock workspace.getConfiguration in integration without sinon (it's read-only prop),
        // we might rely on default or current config. 
        // Default is 'pesosz' in package.json, so it should work by default!

        await (controller as any).poll();

        const hasAgentAccept = commandCalls.includes('antigravity.agent.acceptAgentStep');
        const hasTerminalAccept = commandCalls.includes('antigravity.terminal.accept');

        assert.ok(hasAgentAccept, 'Should call antigravity.agent.acceptAgentStep');
        assert.ok(hasTerminalAccept, 'Should call antigravity.terminal.accept');
    });
});
