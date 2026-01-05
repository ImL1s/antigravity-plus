/**
 * Unit Test Runner for VS Code Extension
 * Intercepts require('vscode') to return mock API.
 */

const Module = require('module');
const path = require('path');

// Create mock vscode API
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
            get: (key, defaultValue) => defaultValue,
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
        asRelativePath: (p) => String(p)
    },
    commands: {
        registerCommand: () => ({ dispose: () => { } }),
        executeCommand: () => Promise.resolve()
    },
    StatusBarAlignment: { Left: 1, Right: 2 },
    Uri: {
        file: (p) => ({ fsPath: p, scheme: 'file', toString: () => p }),
        parse: (p) => ({ fsPath: p, scheme: 'file', toString: () => p }),
        joinPath: () => ({ fsPath: 'joined' })
    },
    Range: class { },
    Position: class { },
    EventEmitter: class { event = () => { }; fire() { } dispose() { } },
    ExtensionContext: class {
        subscriptions = [];
        workspaceState = { get: () => undefined, update: () => Promise.resolve() };
        globalState = { get: () => undefined, update: () => Promise.resolve() };
    },
    OverviewRulerLane: { Left: 1 },
    ThemeColor: class { },
    ThemeIcon: class { }
};

// Hook into Module._resolveFilename to intercept 'vscode' requires
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
    if (request === 'vscode') {
        // Return a path that we'll handle specially
        return 'vscode';
    }
    return originalResolveFilename.call(this, request, parent, isMain, options);
};

// Hook into Module._load to return our mock for 'vscode'
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
    if (request === 'vscode') {
        return mockVScodeApi;
    }
    return originalLoad.call(this, request, parent, isMain);
};

console.log('✅ vscode mock installed');

// Now load Mocha and run tests
const Mocha = require('mocha');
const { globSync } = require('glob');

const mocha = new Mocha({
    ui: 'bdd',
    color: true,
    timeout: 10000
});

const testsRoot = path.resolve(__dirname, 'out/test/unit');
console.log(`🔍 Searching for tests in: ${testsRoot}`);

const files = globSync('**/*.test.js', { cwd: testsRoot, ignore: ['index.js'] });
console.log(`📦 Found ${files.length} test files`);

files.forEach(f => {
    mocha.addFile(path.resolve(testsRoot, f));
});

console.log('🚀 Starting Mocha run...');
mocha.run(failures => {
    console.log(`🏁 Mocha run completed with ${failures} failures`);
    process.exitCode = failures ? 1 : 0;
});
