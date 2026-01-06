/**
 * CDP Overlay Script - 背景模式進度覆蓋層
 * 
 * 參考 MunKhin/auto-accept-agent 的 overlay.js
 * 透過 CDP 注入到瀏覽器中，顯示處理進度
 */

/**
 * 生成要注入的 overlay 腳本
 */
export function getOverlayScript(): string {
    return `
(function() {
    'use strict';

    const OVERLAY_ID = '__antigravityPlusOverlay';
    const STYLE_ID = '__antigravityPlusStyles';

    // 持久化狀態
    window.__antigravityPlusState = window.__antigravityPlusState || {
        startTimes: {},
        tabNames: [],
        completionStatus: {}
    };

    const STYLES = \`
        #__antigravityPlusOverlay {
            position: fixed;
            background: rgba(0, 0, 0, 0.92);
            z-index: 2147483647;
            font-family: system-ui, -apple-system, sans-serif;
            color: #fff;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s ease;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
        }
        #__antigravityPlusOverlay.visible { opacity: 1; }

        .agp-container {
            width: 90%;
            max-width: 400px;
            padding: 24px;
        }

        .agp-header {
            text-align: center;
            margin-bottom: 24px;
        }
        .agp-header h2 {
            font-size: 18px;
            font-weight: 700;
            margin: 0 0 8px 0;
            color: #9333ea;
        }
        .agp-header p {
            font-size: 12px;
            color: rgba(255,255,255,0.6);
            margin: 0;
        }

        .agp-slot {
            margin-bottom: 16px;
            background: rgba(255,255,255,0.05);
            border-radius: 8px;
            padding: 12px;
        }
        .agp-slot-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 8px;
        }
        .agp-slot-name {
            font-size: 13px;
            font-weight: 600;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 200px;
        }
        .agp-slot-status {
            font-size: 10px;
            font-weight: 700;
            padding: 2px 8px;
            border-radius: 4px;
        }
        .agp-slot-status.processing {
            background: rgba(147, 51, 234, 0.2);
            color: #a855f7;
        }
        .agp-slot-status.done {
            background: rgba(34, 197, 94, 0.2);
            color: #22c55e;
        }
        .agp-slot-time {
            font-size: 11px;
            color: rgba(255,255,255,0.5);
        }

        .agp-progress-track {
            height: 4px;
            background: rgba(255,255,255,0.1);
            border-radius: 2px;
            overflow: hidden;
        }
        .agp-progress-fill {
            height: 100%;
            transition: width 0.3s, background 0.3s;
        }
        .agp-progress-fill.processing {
            width: 66%;
            background: linear-gradient(90deg, #9333ea, #a855f7);
        }
        .agp-progress-fill.done {
            width: 100%;
            background: #22c55e;
        }

        .agp-waiting {
            text-align: center;
            color: rgba(255,255,255,0.5);
            font-size: 13px;
        }
        .agp-waiting .spinner {
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 2px solid rgba(255,255,255,0.2);
            border-top-color: #9333ea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-right: 8px;
            vertical-align: middle;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    \`;

    function formatDuration(ms) {
        const s = Math.floor(ms / 1000);
        return s < 60 ? s + 's' : Math.floor(s / 60) + 'm ' + (s % 60) + 's';
    }

    // 創建 Overlay (僅在啟用時呼叫一次)
    window.__antigravityShowOverlay = function() {
        if (document.getElementById(OVERLAY_ID)) {
            console.log('[AG+ Overlay] Already exists');
            return;
        }

        console.log('[AG+ Overlay] Creating...');

        // 注入樣式
        if (!document.getElementById(STYLE_ID)) {
            const style = document.createElement('style');
            style.id = STYLE_ID;
            style.textContent = STYLES;
            document.head.appendChild(style);
        }

        // 建立覆蓋層
        const overlay = document.createElement('div');
        overlay.id = OVERLAY_ID;

        const container = document.createElement('div');
        container.className = 'agp-container';

        const header = document.createElement('div');
        header.className = 'agp-header';
        header.innerHTML = '<h2>🚀 Antigravity+ Background Mode</h2><p>自動處理中...</p>';
        container.appendChild(header);

        const waiting = document.createElement('div');
        waiting.className = 'agp-waiting';
        waiting.id = OVERLAY_ID + '-waiting';
        waiting.innerHTML = '<span class="spinner"></span>掃描對話中...';
        container.appendChild(waiting);

        const slots = document.createElement('div');
        slots.id = OVERLAY_ID + '-slots';
        container.appendChild(slots);

        overlay.appendChild(container);
        document.body.appendChild(overlay);

        requestAnimationFrame(() => overlay.classList.add('visible'));
    };

    // 更新 Overlay (每次輪詢時呼叫)
    window.__antigravityUpdateOverlay = function(tabNames, completionStatus) {
        const state = window.__antigravityPlusState;
        state.tabNames = tabNames || [];
        state.completionStatus = completionStatus || {};

        const slotsContainer = document.getElementById(OVERLAY_ID + '-slots');
        const waiting = document.getElementById(OVERLAY_ID + '-waiting');

        if (!slotsContainer) return;

        if (state.tabNames.length === 0) {
            if (waiting) waiting.style.display = 'block';
            slotsContainer.innerHTML = '';
            return;
        }

        if (waiting) waiting.style.display = 'none';

        // 更新 slots
        state.tabNames.forEach(name => {
            if (!state.startTimes[name]) {
                state.startTimes[name] = Date.now();
            }
            const elapsed = Date.now() - state.startTimes[name];
            const done = state.completionStatus[name] === true;
            const stateClass = done ? 'done' : 'processing';
            const statusText = done ? 'COMPLETED' : 'PROCESSING';

            let slot = slotsContainer.querySelector('[data-name="' + name + '"]');

            if (!slot) {
                slot = document.createElement('div');
                slot.className = 'agp-slot';
                slot.setAttribute('data-name', name);

                const header = document.createElement('div');
                header.className = 'agp-slot-header';

                const nameSpan = document.createElement('span');
                nameSpan.className = 'agp-slot-name';
                nameSpan.textContent = name;
                header.appendChild(nameSpan);

                const statusSpan = document.createElement('span');
                statusSpan.className = 'agp-slot-status ' + stateClass;
                statusSpan.textContent = statusText;
                header.appendChild(statusSpan);

                slot.appendChild(header);

                const timeSpan = document.createElement('div');
                timeSpan.className = 'agp-slot-time';
                timeSpan.textContent = formatDuration(elapsed);
                slot.appendChild(timeSpan);

                const track = document.createElement('div');
                track.className = 'agp-progress-track';
                const fill = document.createElement('div');
                fill.className = 'agp-progress-fill ' + stateClass;
                track.appendChild(fill);
                slot.appendChild(track);

                slotsContainer.appendChild(slot);
            } else {
                const statusSpan = slot.querySelector('.agp-slot-status');
                if (statusSpan) {
                    statusSpan.className = 'agp-slot-status ' + stateClass;
                    statusSpan.textContent = statusText;
                }

                const timeSpan = slot.querySelector('.agp-slot-time');
                if (timeSpan) {
                    timeSpan.textContent = formatDuration(elapsed);
                }

                const fill = slot.querySelector('.agp-progress-fill');
                if (fill) {
                    fill.className = 'agp-progress-fill ' + stateClass;
                }
            }
        });
    };

    // 隱藏 Overlay (僅在停用時呼叫一次)
    window.__antigravityHideOverlay = function() {
        const overlay = document.getElementById(OVERLAY_ID);
        if (overlay) {
            console.log('[AG+ Overlay] Hiding...');
            overlay.classList.remove('visible');
            setTimeout(() => overlay.remove(), 300);
        }
        // 清除狀態
        window.__antigravityPlusState.startTimes = {};
        window.__antigravityPlusState.tabNames = [];
        window.__antigravityPlusState.completionStatus = {};
    };

    console.log('[AG+ Overlay] Script loaded');
})();
`;
}

/**
 * 生成顯示 overlay 的指令
 */
export function getShowOverlayCommand(): string {
    return 'window.__antigravityShowOverlay && window.__antigravityShowOverlay();';
}

/**
 * 生成更新 overlay 的指令
 */
export function getUpdateOverlayCommand(tabNames: string[], completionStatus: Record<string, boolean>): string {
    const tabNamesJson = JSON.stringify(tabNames);
    const completionJson = JSON.stringify(completionStatus);
    return `window.__antigravityUpdateOverlay && window.__antigravityUpdateOverlay(${tabNamesJson}, ${completionJson});`;
}

/**
 * 生成隱藏 overlay 的指令
 */
export function getHideOverlayCommand(): string {
    return 'window.__antigravityHideOverlay && window.__antigravityHideOverlay();';
}
