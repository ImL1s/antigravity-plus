/**
 * 規則引擎
 * 
 * 評估操作是否應該被自動核准或阻擋
 */

import { ConfigManager } from '../../utils/config';
import { ApprovalResult } from './controller';

export interface RuleInput {
    type: 'terminal' | 'file';
    content: string;
    operation?: string;
}

export class RulesEngine {
    private denyList: string[] = [];
    private allowList: string[] = [];

    // 永遠阻擋的危險指令（不可被設定覆蓋）
    private static readonly HARDCODED_DENY_LIST: string[] = [
        'rm -rf /',
        'rm -rf ~',
        'rm -rf /*',
        'rm -rf ~/*',
        'format c:',
        'format d:',
        'del /f /s /q c:\\',
        'del /f /s /q c:/*',
        'dd if=/dev/zero',
        'dd if=/dev/random',
        'mkfs.',
        ':(){:|:&};:',
        'chmod -R 777 /',
        'chmod 777 /',
        'shutdown',
        'reboot',
        'init 0',
        'init 6',
        'halt',
        'poweroff',
        '> /dev/sda',
        'mv /* /dev/null',
        'wget | sh',
        'curl | sh',
        'wget | bash',
        'curl | bash',
    ];

    constructor(private configManager: ConfigManager) {
        this.updateRules();
    }

    /**
     * 從設定更新規則
     */
    public updateRules(): void {
        this.denyList = this.configManager.get<string[]>('autoApprove.denyList') ?? [];
        this.allowList = this.configManager.get<string[]>('autoApprove.allowList') ?? [];
    }

    /**
     * 評估輸入是否應該被核准
     */
    public evaluate(input: RuleInput): ApprovalResult {
        const content = input.content.trim().toLowerCase();

        // 1. 首先檢查硬編碼的禁止清單（永遠不可被覆蓋）
        for (const pattern of RulesEngine.HARDCODED_DENY_LIST) {
            if (this.matchPattern(content, pattern.toLowerCase())) {
                return {
                    approved: false,
                    reason: '危險指令被安全機制阻擋',
                    rule: `HARDCODED_DENY: ${pattern}`
                };
            }
        }

        // 2. 檢查用戶設定的禁止清單
        for (const pattern of this.denyList) {
            if (this.matchPattern(content, pattern.toLowerCase())) {
                return {
                    approved: false,
                    reason: '指令在禁止清單中',
                    rule: `USER_DENY: ${pattern}`
                };
            }
        }

        // 3. 檢查允許清單
        for (const pattern of this.allowList) {
            if (this.matchPattern(content, pattern.toLowerCase())) {
                return {
                    approved: true,
                    rule: `USER_ALLOW: ${pattern}`
                };
            }
        }

        // 4. 預設：對於終端指令，預設允許（如果自動核准已啟用）
        if (input.type === 'terminal') {
            return {
                approved: true,
                rule: 'DEFAULT_ALLOW'
            };
        }

        // 5. 對於檔案操作，預設允許
        if (input.type === 'file') {
            return {
                approved: true,
                rule: 'DEFAULT_ALLOW_FILE'
            };
        }

        return {
            approved: false,
            reason: '未知的操作類型'
        };
    }

    /**
     * 模式匹配
     * 支援簡單的萬用字元 (*)
     */
    private matchPattern(input: string, pattern: string): boolean {
        // 直接包含匹配
        if (input.includes(pattern)) {
            return true;
        }

        // 萬用字元匹配
        if (pattern.includes('*')) {
            const regex = new RegExp(
                '^' + pattern.replace(/\*/g, '.*') + '$',
                'i'
            );
            return regex.test(input);
        }

        // 起始匹配
        if (input.startsWith(pattern)) {
            return true;
        }

        return false;
    }

    /**
     * 新增禁止規則
     */
    public addDenyRule(pattern: string): void {
        if (!this.denyList.includes(pattern)) {
            this.denyList.push(pattern);
            this.saveRules();
        }
    }

    /**
     * 新增允許規則
     */
    public addAllowRule(pattern: string): void {
        if (!this.allowList.includes(pattern)) {
            this.allowList.push(pattern);
            this.saveRules();
        }
    }

    /**
     * 移除規則
     */
    public removeRule(pattern: string, type: 'deny' | 'allow'): void {
        const list = type === 'deny' ? this.denyList : this.allowList;
        const index = list.indexOf(pattern);
        if (index > -1) {
            list.splice(index, 1);
            this.saveRules();
        }
    }

    /**
     * 儲存規則到設定
     */
    private saveRules(): void {
        const config = vscode.workspace.getConfiguration('antigravity-plus');
        config.update('autoApprove.denyList', this.denyList, vscode.ConfigurationTarget.Global);
        config.update('autoApprove.allowList', this.allowList, vscode.ConfigurationTarget.Global);
    }

    /**
     * 取得所有規則
     */
    public getRules(): { denyList: string[]; allowList: string[]; hardcodedDenyList: string[] } {
        return {
            denyList: [...this.denyList],
            allowList: [...this.allowList],
            hardcodedDenyList: [...RulesEngine.HARDCODED_DENY_LIST]
        };
    }
}

import * as vscode from 'vscode';
