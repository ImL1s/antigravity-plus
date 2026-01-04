/**
 * 設定管理器
 */

import * as vscode from 'vscode';

export class ConfigManager {
    private config: vscode.WorkspaceConfiguration;

    constructor() {
        this.config = vscode.workspace.getConfiguration('antigravity-plus');
    }

    public reload(): void {
        this.config = vscode.workspace.getConfiguration('antigravity-plus');
    }

    public get<T>(key: string): T | undefined {
        return this.config.get<T>(key);
    }

    public async set(key: string, value: any, target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global): Promise<void> {
        await this.config.update(key, value, target);
    }
}
