/* eslint-disable */
/**
 * Global Test Setup for Unit Tests
 * 
 * Provides the mock VS Code API for unit tests.
 * This file is required by the fake 'vscode' package in node_modules.
 */

export const mockVScodeApi = {
    window: {
        createStatusBarItem: () => ({
            text: '', tooltip: '', command: '', color: '', backgroundColor: '',
            show: () => { }, hide: () => { }, dispose: () => { }
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
        getCommands: () => Promise.resolve(['antigravity-plus.toggleAutoApprove'])
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
    ThemeColor: class { },
    ThemeIcon: class { },
    extensions: { getExtension: () => undefined },
    env: {
        appName: 'Visual Studio Code',
        language: 'en'
    }
};

console.log('✅ VS Code Mock Provider initialized');
