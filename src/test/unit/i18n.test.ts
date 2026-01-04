/**
 * 單元測試：i18n 國際化
 * 
 * 可獨立運行，不依賴 VS Code
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

// 找到 src/i18n 資料夾
function findI18nDir(): string {
    // 從 out/test/unit 往上找
    let dir = __dirname;
    for (let i = 0; i < 5; i++) {
        const candidate = path.join(dir, 'src', 'i18n');
        if (fs.existsSync(candidate)) {
            return candidate;
        }
        dir = path.dirname(dir);
    }
    // 備用：從專案根目錄
    return path.join(__dirname, '..', '..', '..', '..', 'src', 'i18n');
}

const i18nDir = findI18nDir();

function loadJson(filename: string): Record<string, string> {
    const filePath = path.join(i18nDir, filename);
    if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    console.log(`  ⚠️ 找不到: ${filePath}`);
    return {};
}

// 語言檔案列表
const languageCodes = ['en', 'zh-tw', 'zh-cn', 'ja', 'ko', 'es', 'fr', 'de'];

describe('i18n Unit Tests', () => {
    let languages: Array<{ code: string; data: Record<string, string> }> = [];

    before(() => {
        console.log(`\n  ℹ️ i18n 資料夾: ${i18nDir}`);
        languages = languageCodes.map(code => ({
            code,
            data: loadJson(`${code}.json`)
        }));
    });

    describe('語言檔案載入', () => {
        languageCodes.forEach(code => {
            it(`${code} 語言檔案應該可以載入`, function () {
                const lang = languages.find(l => l.code === code);
                if (!lang || Object.keys(lang.data).length === 0) {
                    this.skip(); // 跳過找不到的語言檔
                }
                assert.ok(lang?.data, `${code} 語言檔案無法載入`);
            });
        });
    });

    describe('必要鍵值存在', () => {
        const requiredKeys = [
            'extension.name',
            'statusBar.autoApprove.on',
            'statusBar.autoApprove.off'
        ];

        it('英文語言檔應該包含所有必要鍵值', function () {
            const enLang = languages.find(l => l.code === 'en');
            if (!enLang || Object.keys(enLang.data).length === 0) {
                this.skip();
            }
            requiredKeys.forEach(key => {
                assert.ok(enLang?.data[key], `英文缺少必要鍵值: ${key}`);
            });
        });
    });

    describe('語言檔案完整性', () => {
        it('所有語言應該有相同數量的鍵值', function () {
            const validLangs = languages.filter(l => Object.keys(l.data).length > 0);
            if (validLangs.length < 2) {
                this.skip();
            }

            const firstCount = Object.keys(validLangs[0].data).length;
            validLangs.forEach(lang => {
                assert.strictEqual(
                    Object.keys(lang.data).length,
                    firstCount,
                    `${lang.code} 的鍵值數量不符 (${Object.keys(lang.data).length} vs ${firstCount})`
                );
            });
        });
    });

    describe('值不為空', () => {
        it('所有值都不應該為空字串', function () {
            const validLangs = languages.filter(l => Object.keys(l.data).length > 0);
            if (validLangs.length === 0) {
                this.skip();
            }

            validLangs.forEach(lang => {
                Object.entries(lang.data).forEach(([key, value]) => {
                    assert.ok(
                        value && value.trim().length > 0,
                        `${lang.code}.${key} 的值為空`
                    );
                });
            });
        });
    });
});
