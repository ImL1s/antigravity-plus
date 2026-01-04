import * as Module from 'module';

export function mockVscode() {
    const originalRequire = (Module.prototype as any).require;

    (Module.prototype as any).require = function (path: string, ...args: any[]) {
        if (path === 'vscode') {
            return {
                workspace: {
                    getConfiguration: () => ({
                        get: () => undefined,
                        update: () => Promise.resolve()
                    })
                },
                ConfigurationTarget: { Global: 1 },
                StatusBarAlignment: { Left: 1, Right: 2 },
                window: {
                    createStatusBarItem: () => ({ show: () => { }, hide: () => { }, dispose: () => { } }),
                    showInformationMessage: () => Promise.resolve(),
                    showInputBox: () => Promise.resolve()
                }
            };
        }
        return originalRequire.apply(this, [path, ...args]);
    };
}
