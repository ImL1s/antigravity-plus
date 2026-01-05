const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, '../../../node_modules/vscode');
const indexFile = path.join(targetDir, 'index.js');
const packageFile = path.join(targetDir, 'package.json');

if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
}

// Write a dummy package.json
fs.writeFileSync(packageFile, JSON.stringify({
    name: 'vscode',
    version: '1.0.0',
    main: 'index.js'
}, null, 2));

// Write the index.js that points to our compiled mock
// Note: We use a relative path from node_modules/vscode to out/test/unit/setup.js
const content = `
const { mockVScodeApi } = require('../../out/test/unit/setup.js');
module.exports = mockVScodeApi;
`;

fs.writeFileSync(indexFile, content);

console.log('✅ Created robust vscode mock package in node_modules/vscode');
