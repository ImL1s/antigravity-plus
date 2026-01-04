/**
 * 國際化 (i18n) 管理器
 * 
 * 支援語言：en, zh-tw, zh-cn, ja, ko, es, fr, de
 */

import * as vscode from 'vscode';
import * as en from './en.json';
import * as zhTw from './zh-tw.json';
import * as zhCn from './zh-cn.json';
import * as ja from './ja.json';
import * as ko from './ko.json';
import * as es from './es.json';
import * as fr from './fr.json';
import * as de from './de.json';

export type SupportedLocale = 'en' | 'zh-tw' | 'zh-cn' | 'ja' | 'ko' | 'es' | 'fr' | 'de';

const locales: Record<SupportedLocale, Record<string, string>> = {
    'en': en,
    'zh-tw': zhTw,
    'zh-cn': zhCn,
    'ja': ja,
    'ko': ko,
    'es': es,
    'fr': fr,
    'de': de
};

let currentLocale: SupportedLocale = 'en';
let currentStrings: Record<string, string> = en;

/**
 * 初始化 i18n
 */
export function initI18n(): void {
    updateLocale();
}

/**
 * 更新語言設定
 */
export function updateLocale(): void {
    const config = vscode.workspace.getConfiguration('antigravity-plus');
    const configLocale = config.get<string>('ui.language') || 'auto';

    if (configLocale === 'auto') {
        // 自動偵測 VS Code 語言
        const vscodeLocale = vscode.env.language.toLowerCase();
        currentLocale = detectLocale(vscodeLocale);
    } else {
        currentLocale = configLocale as SupportedLocale;
    }

    currentStrings = locales[currentLocale] || locales['en'];
}

/**
 * 從 VS Code 語言代碼偵測對應的語系
 */
function detectLocale(vscodeLocale: string): SupportedLocale {
    // 完全匹配
    if (vscodeLocale in locales) {
        return vscodeLocale as SupportedLocale;
    }

    // 語言代碼匹配（例如 zh-tw → zh-tw, zh-cn → zh-cn）
    const languageMap: Record<string, SupportedLocale> = {
        'zh-tw': 'zh-tw',
        'zh-hant': 'zh-tw',
        'zh-hk': 'zh-tw',
        'zh-mo': 'zh-tw',
        'zh-cn': 'zh-cn',
        'zh-hans': 'zh-cn',
        'zh-sg': 'zh-cn',
        'zh': 'zh-cn',
        'ja': 'ja',
        'ja-jp': 'ja',
        'ko': 'ko',
        'ko-kr': 'ko',
        'es': 'es',
        'es-es': 'es',
        'es-mx': 'es',
        'es-ar': 'es',
        'fr': 'fr',
        'fr-fr': 'fr',
        'fr-ca': 'fr',
        'de': 'de',
        'de-de': 'de',
        'de-at': 'de',
        'de-ch': 'de'
    };

    // 嘗試完整代碼
    if (vscodeLocale in languageMap) {
        return languageMap[vscodeLocale];
    }

    // 嘗試前兩個字元
    const shortCode = vscodeLocale.substring(0, 2);
    if (shortCode in languageMap) {
        return languageMap[shortCode];
    }

    // 預設英文
    return 'en';
}

/**
 * 取得翻譯字串
 * 
 * @param key 鍵值，例如 'statusBar.autoApprove.on'
 * @param args 替換參數，用於 {0}, {1} 等佔位符
 */
export function t(key: string, ...args: (string | number)[]): string {
    let text = currentStrings[key] || locales['en'][key] || key;

    // 替換參數
    args.forEach((arg, index) => {
        text = text.replace(`{${index}}`, String(arg));
    });

    return text;
}

/**
 * 取得當前語系
 */
export function getCurrentLocale(): SupportedLocale {
    return currentLocale;
}

/**
 * 取得支援的語系列表
 */
export function getSupportedLocales(): SupportedLocale[] {
    return Object.keys(locales) as SupportedLocale[];
}

/**
 * 取得語系顯示名稱
 */
export function getLocaleDisplayName(locale: SupportedLocale): string {
    const names: Record<SupportedLocale, string> = {
        'en': 'English',
        'zh-tw': '繁體中文',
        'zh-cn': '简体中文',
        'ja': '日本語',
        'ko': '한국어',
        'es': 'Español',
        'fr': 'Français',
        'de': 'Deutsch'
    };
    return names[locale];
}
