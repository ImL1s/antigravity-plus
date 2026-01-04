const Module = require('module');
const originalRequire = Module.prototype.require;

// Enable global mock
try {
    require('./out/test/unit/mock-vscode').mockVscode();
} catch (e) {
    console.warn('Mock setup failed (ok if running from clean state before compile):', e.message);
}

const Mocha = require('mocha');
const path = require('path');

const mocha = new Mocha({
    ui: 'bdd',
    color: true,
    timeout: 10000
});

// Add test files
mocha.addFile(path.join(__dirname, 'out/test/unit/sb_formatter.test.js'));
mocha.addFile(path.join(__dirname, 'out/test/unit/grouping.test.js'));
mocha.addFile(path.join(__dirname, 'out/test/unit/status-bar.test.js'));
mocha.addFile(path.join(__dirname, 'out/test/unit/auto-wakeup.test.js'));

console.log('Running unit tests...');

try {
    mocha.run(failures => {
        process.exitCode = failures ? 1 : 0;
    });
} catch (err) {
    console.error('Error running tests:', err);
    process.exit(1);
}
