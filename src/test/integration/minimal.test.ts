
import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Minimal Integration Test', () => {
    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('ImL1s.antigravity-plus'));
    });
});
