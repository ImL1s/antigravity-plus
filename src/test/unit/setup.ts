/* eslint-disable */
/**
 * Global Test Setup for Unit Tests
 * 
 * This file is required by Mocha before running any tests.
 * It installs the VS Code mock using robust method compatible with Node 20/22+.
 */

const Module = require('module');

// Mock VS Code API
const mockVScodeApi = {
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
        joinPath: () => ({ fsPath: 'joined' })
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

// Install the mock directly into require cache
// This is the most reliable method across Node versions for non-existent modules
const originalLoad = (Module as any)._load;
(Module as any)._load = function (...args: any[]) {
    const request = args[0];
    if (request === 'vscode') {
        return mockVScodeApi;
    }
    return originalLoad.apply(this, args);
};

// Also hook _resolveFilename to prevent "MODULE_NOT_FOUND" before _load is called
const originalResolveFilename = (Module as any)._resolveFilename;
(Module as any)._resolveFilename = function (...args: any[]) {
    const request = args[0];
    if (request === 'vscode') {
        return 'vscode'; // Return dummy path, _load will intercept it
    }
    return originalResolveFilename.apply(this, args);
};

console.log('✅ VS Code Mock installed via setup.ts');
