const Module = require('module');
const originalRequire = Module.prototype.require;

// Mock vscode globally before any test loads
Module.prototype.require = function (path) {
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
                createStatusBarItem: () => ({ show: () => { }, hide: () => { }, dispose: () => { } })
            }
        };
    }
    return originalRequire.apply(this, arguments);
};

const Mocha = require('mocha');
const path = require('path');

const mocha = new Mocha({
    ui: 'tdd',
    color: true
});

// Add test files
mocha.addFile(path.join(__dirname, 'out/test/unit/status-bar-format.test.js'));
mocha.addFile(path.join(__dirname, 'out/test/unit/grouping.test.js'));

console.log('Running unit tests...');

try {
    mocha.run(failures => {
        process.exitCode = failures ? 1 : 0;
    });
} catch (err) {
    console.error('Error running tests:', err);
    process.exit(1);
}
