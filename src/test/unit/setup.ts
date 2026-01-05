/* eslint-disable */
/**
 * Global Test Setup for Unit Tests
 * 
 * This file provides the mock VS Code API.
 * It is consumed by the fake 'vscode' package created in node_modules.
 */

// Mock VS Code API
export const mockVScodeApi = {
    window: {
        createStatusBarItem: () => ({
            text: '',
            tooltip: '',
            command: '',
            color: '',
            backgroundColor: '',
            show: () => { },
            hide: () => { },
            dispose: () => { }
        }),
        showInformationMessage: () => Promise.resolve(),
        showErrorMessage: () => Promise.resolve(),
        showWarningMessage: () => Promise.resolve(),
        visibleTextEditors: [],
        activeTextEditor: undefined,
        onDidChangeActiveTextEditor: () => ({ dispose: () => { } }),
    },
    workspace: {
        getConfiguration: () => ({
            get: (key: string, defaultValue?: any) => defaultValue,
            update: () => Promise.resolve(),
            inspect: () => undefined
        }),
        workspaceFolders: [],
        findFiles: () => Promise.resolve([]),
        onDidSaveTextDocument: () => ({ dispose: () => { } }),
        onDidChangeTextDocument: () => ({ dispose: () => { } }),
        createFileSystemWatcher: () => ({
            onDidCreate: () => ({ dispose: () => { } }),
            onDidDelete: () => ({ dispose: () => { } }),
            dispose: () => { }
        }),
        asRelativePath: (p: any) => String(p)
    },
    commands: {
        registerCommand: () => ({ dispose: () => { } }),
        executeCommand: () => Promise.resolve(),
        getCommands: () => Promise.resolve(['antigravity-plus.toggleAutoApprove', 'antigravity-plus.openDashboard'])
    },
    StatusBarAlignment: { Left: 1, Right: 2 },
    Uri: {
        file: (p: string) => ({ fsPath: p, scheme: 'file', toString: () => p }),
        parse: (p: string) => ({ fsPath: p, scheme: 'file', toString: () => p }),
        joinPath: (...args: any[]) => ({ fsPath: args.join('/') })
    },
    Range: class { },
    Position: class { },
    EventEmitter: class { event = () => { }; fire() { } dispose() { } },
    ExtensionContext: class {
        subscriptions: any[] = [];
        workspaceState = { get: () => undefined, update: () => Promise.resolve() };
        globalState = { get: () => undefined, update: () => Promise.resolve() };
        extensionUri = { fsPath: '/mock/path' };
        asAbsolutePath = (p: string) => p;
    },
    OverviewRulerLane: { Left: 1 },
    ThemeColor: class { },
    ThemeIcon: class { },
    extensions: {
        getExtension: () => ({
            id: 'ImL1s.antigravity-plus',
            isActive: true,
            activate: () => Promise.resolve(),
            exports: {}
        })
    }
};

console.log('✅ VS Code Mock Provider initialized');
