
import * as assert from 'assert';
import * as vscode from 'vscode';

describe('Minimal Integration Test', () => {
    it('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('ImL1s.antigravity-plus'));
    });
});
