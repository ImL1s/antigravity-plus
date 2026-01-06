/**
 * Announcement Types
 * 定義公告系統的資料結構
 */

export enum AnnouncementLevel {
    INFO = 'info',
    WARNING = 'warning',
    CRITICAL = 'critical'
}

export interface Announcement {
    id: string;
    level: AnnouncementLevel;
    message: string;
    detail?: string;
    url?: string;
    urlLabel?: string;
    minVersion?: string; // 最低版本要求 (低於此版本才顯示，或高於此版本才顯示？通常是受影響版本範圍)
    maxVersion?: string;
    expiresAt?: string; // ISO Date string
}

export interface AnnouncementResponse {
    announcements: Announcement[];
    serverTime: string;
}
