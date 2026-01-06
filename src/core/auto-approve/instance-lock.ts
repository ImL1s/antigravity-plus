/**
 * Instance Lock - 防止多視窗 CDP 控制衝突
 * 
 * 參考 MunKhin/auto-accept-agent 的實作
 * 使用 GlobalState 實現跨視窗的鎖定機制
 */

import * as vscode from 'vscode';
import { Logger } from '../../utils/logger';

const LOCK_KEY = 'antigravity-plus-instance-lock';
const HEARTBEAT_KEY = 'antigravity-plus-instance-heartbeat';
const LOCK_TIMEOUT_MS = 15000; // 15 秒超時
const HEARTBEAT_INTERVAL_MS = 5000; // 5 秒心跳

export class InstanceLock implements vscode.Disposable {
    private instanceId: string;
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private isLockOwner = false;
    private context: vscode.ExtensionContext | null = null;

    constructor(private logger: Logger) {
        // 生成唯一實例 ID
        this.instanceId = this.generateInstanceId();
        this.logger.debug(`[InstanceLock] Instance ID: ${this.instanceId}`);
    }

    private generateInstanceId(): string {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * 初始化鎖定機制
     */
    public initialize(context: vscode.ExtensionContext): void {
        this.context = context;
    }

    /**
     * 嘗試獲取鎖定
     * @returns true 如果成功獲取鎖定或已經是鎖定擁有者
     */
    public async acquireLock(): Promise<boolean> {
        if (!this.context) {
            this.logger.error('[InstanceLock] Context not initialized');
            return false;
        }

        const currentLock = this.context.globalState.get<string>(LOCK_KEY);
        const lastHeartbeat = this.context.globalState.get<number>(HEARTBEAT_KEY);

        // 如果我們已經是鎖定擁有者
        if (currentLock === this.instanceId) {
            return true;
        }

        // 如果存在其他實例的鎖定
        if (currentLock && currentLock !== this.instanceId) {
            const now = Date.now();
            // 檢查心跳是否過期
            if (lastHeartbeat && (now - lastHeartbeat) < LOCK_TIMEOUT_MS) {
                this.logger.info(`[InstanceLock] Another instance (${currentLock.substring(0, 8)}...) owns the lock`);
                this.isLockOwner = false;
                return false;
            }
            // 鎖定已過期，可以接管
            this.logger.info('[InstanceLock] Stale lock detected, taking over...');
        }

        // 獲取鎖定
        await this.context.globalState.update(LOCK_KEY, this.instanceId);
        await this.context.globalState.update(HEARTBEAT_KEY, Date.now());
        this.isLockOwner = true;

        // 啟動心跳
        this.startHeartbeat();

        this.logger.info('[InstanceLock] Lock acquired successfully');
        return true;
    }

    /**
     * 釋放鎖定
     */
    public async releaseLock(): Promise<void> {
        if (!this.context) {
            return;
        }

        // 停止心跳
        this.stopHeartbeat();

        const currentLock = this.context.globalState.get<string>(LOCK_KEY);
        if (currentLock === this.instanceId) {
            await this.context.globalState.update(LOCK_KEY, undefined);
            await this.context.globalState.update(HEARTBEAT_KEY, undefined);
            this.logger.info('[InstanceLock] Lock released');
        }

        this.isLockOwner = false;
    }

    /**
     * 檢查是否有其他實例持有鎖定
     */
    public async isLockedByOther(): Promise<boolean> {
        if (!this.context) {
            return false;
        }

        const currentLock = this.context.globalState.get<string>(LOCK_KEY);
        const lastHeartbeat = this.context.globalState.get<number>(HEARTBEAT_KEY);

        if (!currentLock || currentLock === this.instanceId) {
            return false;
        }

        // 檢查心跳是否有效
        const now = Date.now();
        if (lastHeartbeat && (now - lastHeartbeat) < LOCK_TIMEOUT_MS) {
            return true;
        }

        return false;
    }

    /**
     * 檢查當前實例是否持有鎖定
     */
    public isOwner(): boolean {
        return this.isLockOwner;
    }

    /**
     * 啟動心跳
     */
    private startHeartbeat(): void {
        this.stopHeartbeat();

        this.heartbeatInterval = setInterval(async () => {
            if (this.context && this.isLockOwner) {
                await this.context.globalState.update(HEARTBEAT_KEY, Date.now());
            }
        }, HEARTBEAT_INTERVAL_MS);
    }

    /**
     * 停止心跳
     */
    private stopHeartbeat(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    /**
     * 釋放資源
     */
    public dispose(): void {
        this.releaseLock();
    }
}
