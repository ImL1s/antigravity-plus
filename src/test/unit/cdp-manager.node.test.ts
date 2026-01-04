
import * as assert from 'assert';
import { EventEmitter } from 'events';

// Mock Modules
const mockHttp = {
    get: (url: string, cb: (res: any) => void) => {
        const req = new EventEmitter();
        const res = new EventEmitter();
        (res as any).statusCode = 200;

        process.nextTick(() => {
            cb(res);
            if (url.includes('/json/list')) {
                // Delay emission to allow listener registration
                setTimeout(() => {
                    res.emit('data', JSON.stringify([{
                        id: 'page1',
                        type: 'page',
                        url: 'http://example.com',
                        webSocketDebuggerUrl: 'ws://127.0.0.1:9222/devtools/page/page1'
                    }]));
                    res.emit('end');
                }, 5);
            }
        });
        return req;
    }
};

class MockWebSocket extends EventEmitter {
    readyState = 1; // OPEN
    constructor(url?: string) {
        super();
        console.log('MockWebSocket created for', url);
        setTimeout(() => this.emit('open'), 10);
    }
    send(_msg: string) { }
    terminate() { }
    close() { }
    static OPEN = 1;
}

// Mock Require for HTTP only (since CDPManager uses http)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function (path: string, ...args: any[]) {
    if (path === 'http') return mockHttp;
    return originalRequire.apply(this, [path, ...args]);
};

// Import code under test
import { CDPManager } from '../../core/auto-approve/cdp-manager';
import { FULL_CDP_SCRIPT } from '../../core/auto-approve/scripts/full-cdp-script';

describe.skip('CDPManager (Node Unit)', () => {
    let manager: CDPManager;
    let loggerEntries: string[] = [];
    const mockLogger = {
        info: (msg: string) => loggerEntries.push(`INFO: ${msg}`),
        error: (msg: string) => loggerEntries.push(`ERROR: ${msg}`),
        debug: (msg: string) => loggerEntries.push(`DEBUG: ${msg}`),
        warn: (msg: string) => loggerEntries.push(`WARN: ${msg}`),
        log: () => { },
        showOutputChannel: () => { },
        dispose: () => { }
    };

    beforeEach(() => {
        loggerEntries = [];
        // INJECT MOCK PROPERLY
        manager = new CDPManager(mockLogger as any, MockWebSocket as any);
    });

    afterEach(() => {
        manager.dispose();
    });

    it('should connect and inject script', async () => {
        const config = {
            denyList: ['rm -rf'],
            allowList: [],
            clickInterval: 500
        };

        const success = await manager.tryConnectAndInject(config);

        const logs = loggerEntries.join('\n');
        if (!success) {
            throw new Error(`CDP Connect Failed. Logs:\n${logs}\nMockWS Created? ${logs.indexOf('Connected to CDP')}`);
        }
        assert.strictEqual(success, true);

        assert.ok(logs.includes('Connected to CDP WebSocket'));
        assert.ok(logs.includes('Auto Accept Script Injected via CDP'));

        // Verify script content
        assert.ok(FULL_CDP_SCRIPT.includes('__antigravityPlusOverlay'), 'Script should contain overlay ID');
        assert.ok(FULL_CDP_SCRIPT.includes('updateOverlay'), 'Script should contain updateOverlay function');
    });
});
