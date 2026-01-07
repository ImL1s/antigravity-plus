/**
 * Auto Wake-up Types - 類型定義
 * 
 * 對齊 antigravity-cockpit 的 auto_trigger/types.ts
 */

/**
 * OAuth 憑證資料
 */
export interface OAuthCredential {
    clientId: string;
    clientSecret: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: string;  // ISO 8601 格式
    projectId?: string;
    scopes: string[];
    email?: string;
}

/**
 * 授權狀態
 */
export interface AuthorizationStatus {
    isAuthorized: boolean;
    email?: string;
    expiresAt?: string;
    lastRefresh?: string;
}

/**
 * Access Token 結果
 */
export interface AccessTokenResult {
    state: 'ok' | 'expired' | 'invalid_grant' | 'refresh_failed' | 'not_authorized';
    token?: string;
    error?: string;
}

/**
 * 排程重複模式
 */
export type ScheduleRepeatMode = 'daily' | 'weekly' | 'interval';

/**
 * 星期幾 (0 = Sunday)
 */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * 排程配置
 */
export interface ScheduleConfig {
    enabled: boolean;
    repeatMode: ScheduleRepeatMode;

    // 每天模式
    dailyTimes?: string[];  // ["07:00", "12:00", "17:00"]

    // 每週模式
    weeklyDays?: number[];  // [1, 2, 3, 4, 5] = 工作日 (0 = Sunday)
    weeklyTimes?: string[];

    // 間隔模式
    intervalHours?: number;
    intervalStartTime?: string;  // "07:00"
    intervalEndTime?: string;    // "22:00" (可選，不填則全天)

    // 進階: 原始 crontab 表達式
    crontab?: string;

    /** 選中的模型列表 (用於觸發) */
    selectedModels: string[];

    /** 配額重置時自動喚醒 */
    wakeOnReset?: boolean;

    /** 自訂喚醒詞 (預設: "hi") */
    customPrompt?: string;
}

/**
 * 觸發記錄
 */
export interface TriggerRecord {
    timestamp: string;  // ISO 8601
    success: boolean;
    prompt?: string;    // 發送的請求內容
    message?: string;   // AI 的回覆
    duration?: number;  // ms
    triggerType?: 'manual' | 'auto';
    triggerSource?: 'manual' | 'scheduled' | 'crontab' | 'quota_reset';
    models?: string[];  // 觸發的模型列表
}

/**
 * 模型資訊（用於自動觸發）
 */
export interface ModelInfo {
    /** 模型 ID (用於 API 呼叫，如 gemini-3-pro-high) */
    id: string;
    /** 顯示名稱 (如 Gemini 3 Pro (High)) */
    displayName: string;
    /** 模型常數 (用於與配額匹配) */
    modelConstant: string;
}

/**
 * 自動觸發狀態
 */
export interface AutoTriggerState {
    authorization: AuthorizationStatus;
    schedule: ScheduleConfig;
    lastTrigger?: TriggerRecord;
    recentTriggers: TriggerRecord[];  // 最近 10 條
    nextTriggerTime?: string;  // ISO 8601
    /** 可選的模型列表 */
    availableModels: ModelInfo[];
}

/**
 * Webview 訊息類型
 */
export interface AutoTriggerMessage {
    type:
    | 'auto_trigger_get_state'
    | 'auto_trigger_start_auth'
    | 'auto_trigger_revoke_auth'
    | 'auto_trigger_save_schedule'
    | 'auto_trigger_test_trigger'
    | 'auto_trigger_state_update'
    | 'auto_trigger_clear_history';
    data?: {
        models?: string[];
        schedule?: Partial<ScheduleConfig>;
        [key: string]: unknown;
    };
}

/**
 * Crontab 解析結果
 */
export interface CrontabParseResult {
    valid: boolean;
    description?: string;  // 人類可讀描述
    nextRuns?: Date[];     // 接下來幾次執行時間
    error?: string;
}

/**
 * 預設排程模板
 */
export interface SchedulePreset {
    id: string;
    name: string;
    description: string;
    config: Partial<ScheduleConfig>;
}

/**
 * 預設排程模板列表
 */
export const SCHEDULE_PRESETS: SchedulePreset[] = [
    {
        id: 'morning',
        name: '早間預觸發',
        description: '每天早上 7:00 觸發一次',
        config: {
            repeatMode: 'daily',
            dailyTimes: ['07:00'],
            selectedModels: ['gemini-3-flash'],
        },
    },
    {
        id: 'workday',
        name: '工作日預觸發',
        description: '工作日早上 8:00 觸發',
        config: {
            repeatMode: 'weekly',
            weeklyDays: [1, 2, 3, 4, 5],
            weeklyTimes: ['08:00'],
            selectedModels: ['gemini-3-flash'],
        },
    },
    {
        id: 'every4h',
        name: '每 4 小時觸發',
        description: '從 7:00 開始，每 4 小時觸發一次',
        config: {
            repeatMode: 'interval',
            intervalHours: 4,
            intervalStartTime: '07:00',
            intervalEndTime: '23:00',
            selectedModels: ['gemini-3-flash'],
        },
    },
];

/**
 * 預設排程配置
 */
export const DEFAULT_SCHEDULE_CONFIG: ScheduleConfig = {
    enabled: false,
    repeatMode: 'daily',
    dailyTimes: ['07:00'],
    selectedModels: ['gemini-3-flash'],
    wakeOnReset: true,
    customPrompt: 'hi',
};

/**
 * Antigravity API 配置
 */
export const ANTIGRAVITY_API_CONFIG = {
    BASE_URL: 'https://daily-cloudcode-pa.sandbox.googleapis.com',
    USER_AGENT: 'antigravity/1.0.0 antigravity-plus',
    REQUEST_TIMEOUT_MS: 30_000,
    MAX_TRIGGER_CONCURRENCY: 4,
    RESET_TRIGGER_COOLDOWN_MS: 10 * 60 * 1000, // 10 分鐘
};

/**
 * OAuth 配置
 */
export const OAUTH_CONFIG = {
    AUTH_URL: 'https://accounts.google.com/o/oauth2/v2/auth',
    TOKEN_URL: 'https://oauth2.googleapis.com/token',
    SCOPES: [
        'https://www.googleapis.com/auth/cloud-platform',
        'openid',
        'email',
        'profile'
    ],
    REDIRECT_URI: 'http://localhost:9876/callback',
};
