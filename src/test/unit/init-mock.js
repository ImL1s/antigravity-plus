const fs = require('fs');
const path = require('path');

/**
 * Robust VS Code Mock Initializer
 * Creates a fake 'vscode' package in node_modules to avoid runtime hijacking.
 */
function initMock() {
    const rootDir = process.cwd();
    const targetDir = path.resolve(rootDir, 'node_modules/vscode');
    const indexFile = path.join(targetDir, 'index.js');
    const packageFile = path.join(targetDir, 'package.json');

    console.log(`[MockInit] Target: ${targetDir}`);

    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    // Standard package.json for the fake module
    fs.writeFileSync(packageFile, JSON.stringify({
        name: 'vscode',
        version: '1.0.0',
        main: 'index.js'
    }, null, 2));

    // index.js: Resolves the mock from the compiled setup.js
    const setupPath = path.resolve(rootDir, 'out/test/unit/setup.js').replace(/\\/g, '/');
    const content = `
'use strict';
const path = require('path');
const setupPath = "${setupPath}";
console.log('[vscode-mock] Loading from:', setupPath);
try {
    const { mockVScodeApi } = require(setupPath);
    module.exports = mockVScodeApi;
} catch (e) {
    console.error('[vscode-mock] Failed to load mock:', e);
    process.exit(1);
}
`;

    fs.writeFileSync(indexFile, content);
    console.log('✅ Created robust vscode mock package in node_modules/vscode');
}

initMock();
