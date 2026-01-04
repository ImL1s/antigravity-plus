/**
 * 操作日誌記錄器
 * 
 * 記錄所有自動核准/阻擋的操作
 */

import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';

export interface OperationLog {
    id: string;
    timestamp: Date;
    type: 'file_edit' | 'terminal_command' | 'blocked';
    action: 'approved' | 'blocked' | 'manual';
    details: string;
    rule?: string;
}

export class OperationLogger {
    private logs: OperationLog[] = [];
    private readonly MAX_LOGS = 1000;
    private readonly STORAGE_KEY = 'antigravity-plus.operationLogs';

    constructor(private context: vscode.ExtensionContext) {
        this.loadLogs();
    }

    /**
     * 記錄操作
     */
    public log(entry: Omit<OperationLog, 'id' | 'timestamp'>): void {
        const log: OperationLog = {
            id: uuidv4(),
            timestamp: new Date(),
            ...entry
        };

        this.logs.unshift(log);

        // 限制日誌數量
        if (this.logs.length > this.MAX_LOGS) {
            this.logs = this.logs.slice(0, this.MAX_LOGS);
        }

        this.saveLogs();
    }

    /**
     * 取得日誌
     */
    public getLogs(limit?: number): OperationLog[] {
        if (limit) {
            return this.logs.slice(0, limit);
        }
        return [...this.logs];
    }

    /**
     * 取得特定類型的日誌
     */
    public getLogsByType(type: OperationLog['type'], limit?: number): OperationLog[] {
        const filtered = this.logs.filter(log => log.type === type);
        if (limit) {
            return filtered.slice(0, limit);
        }
        return filtered;
    }

    /**
     * 取得統計資料
     */
    public getStats(): {
        total: number;
        approved: number;
        blocked: number;
        today: number;
        todayApproved: number;
        todayBlocked: number;
    } {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayLogs = this.logs.filter(log =>
            new Date(log.timestamp) >= today
        );

        return {
            total: this.logs.length,
            approved: this.logs.filter(log => log.action === 'approved').length,
            blocked: this.logs.filter(log => log.action === 'blocked').length,
            today: todayLogs.length,
            todayApproved: todayLogs.filter(log => log.action === 'approved').length,
            todayBlocked: todayLogs.filter(log => log.action === 'blocked').length
        };
    }

    /**
     * 清除日誌
     */
    public clear(): void {
        this.logs = [];
        this.saveLogs();
    }

    /**
     * 儲存日誌到持久化儲存
     */
    private saveLogs(): void {
        // 只儲存必要的欄位以減少空間
        const logsToSave = this.logs.map(log => ({
            ...log,
            timestamp: log.timestamp.toISOString()
        }));

        this.context.globalState.update(this.STORAGE_KEY, logsToSave);
    }

    /**
     * 從持久化儲存載入日誌
     */
    private loadLogs(): void {
        const savedLogs = this.context.globalState.get<any[]>(this.STORAGE_KEY);

        if (savedLogs && Array.isArray(savedLogs)) {
            this.logs = savedLogs.map(log => ({
                ...log,
                timestamp: new Date(log.timestamp)
            }));
        }
    }

    /**
     * 匯出日誌
     */
    public export(format: 'json' | 'csv'): string {
        if (format === 'json') {
            return JSON.stringify(this.logs, null, 2);
        }

        // CSV 格式
        const headers = ['ID', 'Timestamp', 'Type', 'Action', 'Details', 'Rule'];
        const rows = this.logs.map(log => [
            log.id,
            log.timestamp.toISOString(),
            log.type,
            log.action,
            `"${log.details.replace(/"/g, '""')}"`,
            log.rule || ''
        ]);

        return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    }
}
