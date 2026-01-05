const Module = require('module');
const originalRequire = Module.prototype.require;

// Enable global mock
try {
    try {
        require('./out/test/unit/mock-vscode').mockVscode();
        console.log('✅ Mock vscode loaded successfully');
    } catch (e) {
        console.error('❌ Failed to load mock-vscode:', e);
    }

    // Create the mocha test
    const Mocha = require('mocha');
    const path = require('path');
    const glob = require('glob');

    const mocha = new Mocha({
        ui: 'tdd',
        color: true,
        timeout: 10000 // Increase timeout
    });

    const testsRoot = path.resolve(__dirname, 'out/test/unit');
    console.log(`🔍 Searching for tests in: ${testsRoot}`);

    const files = glob.sync('**/*.test.js', { cwd: testsRoot });
    console.log(`📦 Found ${files.length} test files`);

    files.forEach(f => {
        const filePath = path.resolve(testsRoot, f);
        // console.log(`Adding test file: ${filePath}`);
        mocha.addFile(filePath);
    });

    console.log('🚀 Starting Mocha run...');
    mocha.run(failures => {
        console.log(`🏁 Mocha run completed with ${failures} failures`);
        process.exitCode = failures ? 1 : 0;
    });
} catch (err) {
    console.error('Error running tests:', err);
    process.exit(1);
}
