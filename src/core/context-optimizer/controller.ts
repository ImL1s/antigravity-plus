import * as vscode from 'vscode';
import { Logger } from '../../utils/logger';
import { ConfigManager } from '../../utils/config';

export interface ContextSuggestion {
    file: vscode.Uri;
    score: number;
    reason: string;
    action: 'pin' | 'unpin' | 'none';
}

export class ContextOptimizerController {
    constructor(
        private context: vscode.ExtensionContext,
        private logger: Logger,
        private configManager: ConfigManager
    ) { }

    /**
     * 分析當前工作區並提供優化建議
     */
    public async analyzeContext(): Promise<ContextSuggestion[]> {
        this.logger.info('正在分析工作區內容以進行優化建議...');

        const suggestions: ContextSuggestion[] = [];
        const workspaceFolders = vscode.workspace.workspaceFolders;

        if (!workspaceFolders) {
            return suggestions;
        }

        // 取得目前開啟的編輯器
        const openEditors = vscode.window.visibleTextEditors;
        const openFiles = new Set(openEditors.map(e => e.document.uri.fsPath));

        // 取得工作區中的所有檔案 (限制數量避免效能問題)
        const files = await vscode.workspace.findFiles('**/*', '**/node_modules/**', 100);

        for (const file of files) {
            let score = 0;
            let reason = '';
            let action: 'pin' | 'unpin' | 'none' = 'none';

            const isOpened = openFiles.has(file.fsPath);
            const isTestFile = file.fsPath.includes('test') || file.fsPath.includes('spec');
            const isConfigFile = file.fsPath.endsWith('package.json') || file.fsPath.endsWith('tsconfig.json');

            if (isOpened) {
                score += 50;
                reason = '目前正開啟中';
                action = 'pin';
            } else if (isConfigFile) {
                score += 30;
                reason = '關鍵設定檔';
                action = 'pin';
            } else if (isTestFile) {
                score -= 20;
                reason = '測試檔案可延後載入';
                action = 'unpin';
            }

            if (action !== 'none') {
                suggestions.push({
                    file,
                    score,
                    reason,
                    action
                });
            }
        }

        // 按分數排序
        return suggestions.sort((a, b) => b.score - a.score);
    }

    /**
     * 執行優化建議 (例如生成專屬提示詞)
     */
    public async applyOptimization(suggestions: ContextSuggestion[]): Promise<void> {
        const pinFiles = suggestions.filter(s => s.action === 'pin').map(s => s.file.fsPath);
        this.logger.info(`已建議 Pin 檔案: ${pinFiles.length} 個`);

        const message = `Context 優化完成！建議優先關注 ${pinFiles.length} 個檔案。`;
        vscode.window.showInformationMessage(message);
    }
}
