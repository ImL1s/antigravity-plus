import * as Module from 'module';

export function mockVscode() {
    const originalLoad = (Module as any)._load;

    (Module as any)._load = function (request: string, parent: any) {
        if (request === 'vscode') {
            return {
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
                    asRelativePath: (path: any) => path.toString()
                },
                commands: {
                    registerCommand: () => ({ dispose: () => { } }),
                    executeCommand: () => Promise.resolve()
                },
                StatusBarAlignment: {
                    Left: 1,
                    Right: 2
                },
                Uri: {
                    file: (path: string) => ({ fsPath: path, scheme: 'file', toString: () => path }),
                    parse: (path: string) => ({ fsPath: path, scheme: 'file', toString: () => path }),
                    joinPath: () => ({ fsPath: 'joined' })
                },
                Range: class { },
                Position: class { },
                EventEmitter: class {
                    event = () => { };
                    fire() { }
                    dispose() { }
                },
                ExtensionContext: class {
                    subscriptions: any[] = [];
                    workspaceState = {
                        get: () => undefined,
                        update: () => Promise.resolve()
                    };
                    globalState = {
                        get: () => undefined,
                        update: () => Promise.resolve()
                    };
                },
                OverviewRulerLane: {
                    Left: 1
                },
                ThemeColor: class { },
                ThemeIcon: class { }
            };
        }
        return originalLoad.apply(this, arguments);
    };
}
