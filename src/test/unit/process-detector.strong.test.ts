
import * as assert from 'assert';
import { ProcessDetector } from '../../core/quota-monitor/process-detector';

// MOCK SETUP
let mockExecOutput: string = '';
let mockHttpResponses: Record<number, any> = {};

const mockLogger = {
    debug: (msg: string) => console.log('DEBUG:', msg),
    info: (msg: string) => { },
    warn: (msg: string) => { },
    error: (msg: string) => console.error('ERROR:', msg),
    log: () => { },
    showOutputChannel: () => { },
    dispose: () => { }
};

// Mock Executor
const mockExecutor = async (cmd: string, opts: any) => {
    return { stdout: mockExecOutput, stderr: '' };
};

// Mock HTTP (still need Module mock for internal requires inside ProcessDetector?)
// Actually ProcessDetector uses require('http') inside testPort.
// Since testPort is private, we can't easily inject http client without more refactoring.
// BUT, we can mock `testPort` method itself or rely on the previous module mock strategy 
// WHICH MIGHT STILL FAIL if require is not intercepted.
// Let's try to intercept require('http') again, or just overwrite the private method `testPort` on the instance if possible.
// Overwriting private method is easier for this specific "Strong" test without huge refactor.

const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function (path: string) {
    if (path === 'http') {
        return {
            request: (opts: any, cb: any) => {
                const res: any = {
                    on: (event: string, handler: Function) => {
                        if (event === 'data') {
                            const data = mockHttpResponses[opts.port];
                            if (data) handler(JSON.stringify(data));
                        }
                        if (event === 'end') handler();
                    }
                };
                setTimeout(() => cb(res), 10);
                return { on: () => { }, end: () => { }, destroy: () => { } };
            }
        };
    }
    return originalRequire.apply(this, arguments);
};

describe('ProcessDetector Robust Tests', () => {
    let detector: ProcessDetector;

    beforeEach(() => {
        detector = new ProcessDetector(mockLogger as any, mockExecutor);
        mockExecOutput = '';
        mockHttpResponses = {};
    });

    it('should detect Windows process with correct flags', async () => {
        mockExecOutput = `
Node,CommandLine,ProcessId
MY-PC,"C:\\Users\\User\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe" --remote-debugging-port=9222,12345
`;
        mockHttpResponses[9222] = { Browser: 'vscode', webSocketDebuggerUrl: 'ws://...' };

        const process = await (detector as any).detectWindows();

        assert.ok(process, 'Should find a process');
        assert.strictEqual(process.pid, 12345);
        assert.ok(process.endpoint.includes('9222'));
    });

    it('should detect Mac process from ps aux', async () => {
        mockExecOutput = `
user             55555   0.0  0.0  123  456 ??  S    10:00AM   /Applications/Visual Studio Code.app/Contents/MacOS/Electron --remote-debugging-port=9333
`;
        mockHttpResponses[9333] = { Browser: 'vscode', webSocketDebuggerUrl: 'ws://...' };

        const process = await (detector as any).detectMac();

        if (!process) {
            throw new Error(`Detection Failed. Mock Output: ${mockExecOutput}`);
        }

        assert.strictEqual(process.pid, 55555);
        assert.ok(process.endpoint.includes('9333'));
    });
});
