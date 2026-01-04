/**
 * 獨立單元測試運行器
 */

const Mocha = require('mocha');
const path = require('path');
const fs = require('fs');

// Mock VS Code module for Node.js environment
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function (path) {
    if (path === 'vscode') {
        return {
            window: {
                createOutputChannel: () => ({
                    appendLine: () => { },
                    show: () => { },
                    dispose: () => { }
                }),
                showErrorMessage: () => { },
                showInformationMessage: () => { },
            },
            workspace: {
                getConfiguration: () => ({ get: () => { } }),
            },
            Disposable: class { dispose() { } },
            EventEmitter: require('events').EventEmitter
        };
    }
    return originalRequire.apply(this, arguments);
};

const mocha = new Mocha({
    ui: 'bdd',  // 使用 BDD 介面 (describe, it)
    color: true,
    timeout: 10000
});

function findTestFiles(dir, files = []) {
    if (!fs.existsSync(dir)) return files;

    const items = fs.readdirSync(dir);

    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            findTestFiles(fullPath, files);
        } else if (item.endsWith('.test.js')) {
            files.push(fullPath);
        }
    }

    return files;
}

const testDir = path.join(__dirname, 'out', 'test', 'unit');
const testFiles = findTestFiles(testDir);

console.log(`\n🧪 Antigravity Plus 單元測試`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`找到 ${testFiles.length} 個測試檔案:\n`);
testFiles.forEach(f => console.log(`  📄 ${path.basename(f)}`));
console.log('\n');

testFiles.forEach(f => mocha.addFile(f));

mocha.run(failures => {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (failures === 0) {
        console.log('✅ 所有測試通過！');
    } else {
        console.log(`❌ ${failures} 個測試失敗`);
    }
    process.exitCode = failures ? 1 : 0;
});
