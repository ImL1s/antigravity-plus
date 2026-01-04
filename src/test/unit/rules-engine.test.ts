/**
 * 單元測試：規則引擎
 * 
 * 可獨立運行，不依賴 VS Code
 */

import * as assert from 'assert';

// Mock ConfigManager
const mockConfigManager = {
    get: (key: string) => {
        if (key === 'autoApprove.denyList') {
            return ['npm publish', 'git push --force'];
        }
        if (key === 'autoApprove.allowList') {
            return ['npm install', 'npm run dev'];
        }
        return undefined;
    }
};

// 直接複製 RulesEngine 的核心邏輯進行測試
class TestRulesEngine {
    private denyList: string[] = [];
    private allowList: string[] = [];

    private static readonly HARDCODED_DENY_LIST: string[] = [
        'rm -rf /',
        'rm -rf ~',
        'rm -rf /*',
        'format c:',
        'format d:',
        'dd if=/dev/zero',
        'mkfs.',
        ':(){:|:&};:',
        'chmod -R 777 /',
        'shutdown',
        'reboot',
    ];

    constructor(private configManager: any) {
        this.updateRules();
    }

    public updateRules(): void {
        this.denyList = this.configManager.get('autoApprove.denyList') ?? [];
        this.allowList = this.configManager.get('autoApprove.allowList') ?? [];
    }

    public evaluate(input: { type: string; content: string; operation?: string }): { approved: boolean; rule?: string; reason?: string } {
        const content = input.content.trim().toLowerCase();

        // 硬編碼黑名單
        for (const pattern of TestRulesEngine.HARDCODED_DENY_LIST) {
            if (this.matchPattern(content, pattern.toLowerCase())) {
                return {
                    approved: false,
                    reason: '危險指令被安全機制阻擋',
                    rule: `HARDCODED_DENY: ${pattern}`
                };
            }
        }

        // 用戶黑名單
        for (const pattern of this.denyList) {
            if (this.matchPattern(content, pattern.toLowerCase())) {
                return {
                    approved: false,
                    reason: '指令在禁止清單中',
                    rule: `USER_DENY: ${pattern}`
                };
            }
        }

        // 白名單
        for (const pattern of this.allowList) {
            if (this.matchPattern(content, pattern.toLowerCase())) {
                return {
                    approved: true,
                    rule: `USER_ALLOW: ${pattern}`
                };
            }
        }

        // 預設允許
        if (input.type === 'terminal') {
            return { approved: true, rule: 'DEFAULT_ALLOW' };
        }

        if (input.type === 'file') {
            return { approved: true, rule: 'DEFAULT_ALLOW_FILE' };
        }

        return { approved: false, reason: '未知的操作類型' };
    }

    private matchPattern(input: string, pattern: string): boolean {
        if (input.includes(pattern)) return true;
        if (pattern.includes('*')) {
            const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$', 'i');
            return regex.test(input);
        }
        if (input.startsWith(pattern)) return true;
        return false;
    }
}

describe('RulesEngine Unit Tests', () => {
    let rulesEngine: TestRulesEngine;

    beforeEach(() => {
        rulesEngine = new TestRulesEngine(mockConfigManager);
    });

    describe('硬編碼黑名單', () => {
        it('應該阻擋 rm -rf /', () => {
            const result = rulesEngine.evaluate({ type: 'terminal', content: 'rm -rf /' });
            assert.strictEqual(result.approved, false);
            assert.ok(result.rule?.includes('HARDCODED_DENY'));
        });

        it('應該阻擋 format c:', () => {
            const result = rulesEngine.evaluate({ type: 'terminal', content: 'format c:' });
            assert.strictEqual(result.approved, false);
        });

        it('應該阻擋 dd if=/dev/zero', () => {
            const result = rulesEngine.evaluate({ type: 'terminal', content: 'dd if=/dev/zero of=/dev/sda' });
            assert.strictEqual(result.approved, false);
        });

        it('應該阻擋 fork bomb', () => {
            const result = rulesEngine.evaluate({ type: 'terminal', content: ':(){:|:&};:' });
            assert.strictEqual(result.approved, false);
        });

        it('應該阻擋 shutdown', () => {
            const result = rulesEngine.evaluate({ type: 'terminal', content: 'shutdown -h now' });
            assert.strictEqual(result.approved, false);
        });
    });

    describe('用戶黑名單', () => {
        it('應該阻擋用戶添加的危險指令', () => {
            const result = rulesEngine.evaluate({ type: 'terminal', content: 'npm publish' });
            assert.strictEqual(result.approved, false);
            assert.ok(result.rule?.includes('USER_DENY'));
        });

        it('應該阻擋 git push --force', () => {
            const result = rulesEngine.evaluate({ type: 'terminal', content: 'git push --force origin main' });
            assert.strictEqual(result.approved, false);
        });
    });

    describe('白名單', () => {
        it('應該允許白名單中的指令', () => {
            const result = rulesEngine.evaluate({ type: 'terminal', content: 'npm install lodash' });
            assert.strictEqual(result.approved, true);
            assert.ok(result.rule?.includes('USER_ALLOW'));
        });

        it('應該允許 npm run dev', () => {
            const result = rulesEngine.evaluate({ type: 'terminal', content: 'npm run dev' });
            assert.strictEqual(result.approved, true);
        });
    });

    describe('預設行為', () => {
        it('未在任何名單中的指令應該預設允許', () => {
            const result = rulesEngine.evaluate({ type: 'terminal', content: 'ls -la' });
            assert.strictEqual(result.approved, true);
            assert.strictEqual(result.rule, 'DEFAULT_ALLOW');
        });

        it('檔案操作應該預設允許', () => {
            const result = rulesEngine.evaluate({ type: 'file', content: '/src/index.ts', operation: 'edit' });
            assert.strictEqual(result.approved, true);
        });
    });
});
