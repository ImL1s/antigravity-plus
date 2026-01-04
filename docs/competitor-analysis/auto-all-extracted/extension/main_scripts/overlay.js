

const OVERLAY_ID = '__autoAllBgOverlay';
const STYLE_ID = '__autoAllBgStyles';

window.__autoAllState = window.__autoAllState || { startTimes: {} };
window.__autoAllState.startTimes = window.__autoAllState.startTimes || {};
const startTimes = window.__autoAllState.startTimes;

const STYLES = `
    #__autoAllBgOverlay {
        position: fixed;
        background: rgba(0, 0, 0, 0.95);
        z-index: 2147483647;
        font-family: system-ui, -apple-system, sans-serif;
        color: #fff;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.2s;
    }
    #__autoAllBgOverlay.visible { opacity: 1; }
    .aab-container { width: 90%; max-width: 400px; }
    .aab-slot { margin-bottom: 20px; }
    .aab-header { display: flex; align-items: center; margin-bottom: 4px; gap: 8px; font-size: 12px; }
    .aab-name { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .aab-status { font-weight: bold; font-size: 10px; }
    .aab-progress-track { height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden; }
    .aab-progress-fill { height: 100%; transition: width 0.3s, background 0.3s; }
    .initiating .aab-progress-fill { width: 33%; background: #3b82f6; }
    .processing .aab-progress-fill { width: 66%; background: #a855f7; }
    .done .aab-progress-fill { width: 100%; background: #22c55e; }
    .done .aab-status { color: #22c55e; }
`;

function formatDuration(ms) {
    const s = Math.floor(ms / 1000);
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

function findTargetPanel(ide) {
    if (ide == "antigravity") {
        return queryAll('#antigravity\\.agentPanel').find(p => p.offsetWidth > 50) || null;
    } else if (ide == "cursor") {
        return queryAll('#workbench\\.parts\\.auxiliarybar').find(p => p.offsetWidth > 50) || null;
    }
    return null;
}

export function showOverlay() {
    if (document.getElementById(OVERLAY_ID)) {
        console.log('[Overlay] Already exists, skipping creation');
        return;
    }

    console.log('[Overlay] Creating overlay...');
    const state = window.__autoAllState;

    if (!document.getElementById(STYLE_ID)) {
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = STYLES;
        document.head.appendChild(style);
    }

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;

    const container = document.createElement('div');
    container.className = 'aab-container';
    container.id = OVERLAY_ID + '-c';
    overlay.appendChild(container);

    document.body.appendChild(overlay);

    const ide = state.ide || state.currentMode || 'cursor';
    const target = findTargetPanel(ide);

    const sync = () => {
        const t = findTargetPanel(ide);
        if (t) {
            const r = t.getBoundingClientRect();
            Object.assign(overlay.style, { top: r.top + 'px', left: r.left + 'px', width: r.width + 'px', height: r.height + 'px' });
        } else {
            Object.assign(overlay.style, { top: '0', left: '0', width: '100%', height: '100%' });
        }
    };

    sync();
    if (target) {
        new ResizeObserver(sync).observe(target);
    }

    const waitingDiv = document.createElement('div');
    waitingDiv.className = 'aab-waiting';
    waitingDiv.style.cssText = 'color:#888; font-size:12px;';
    waitingDiv.textContent = 'Scanning for conversations...';
    container.appendChild(waitingDiv);

    requestAnimationFrame(() => overlay.classList.add('visible'));
}

export function updateOverlay() {
    const state = window.__autoAllState;
    const container = document.getElementById(OVERLAY_ID + '-c');

    if (!container) {
        
        return;
    }

    const tabNames = state.tabNames || [];
    const completions = state.completionStatus || {};

    if (tabNames.length === 0) {
        if (!container.querySelector('.aab-waiting')) {
            container.textContent = '';
            const waitingDiv = document.createElement('div');
            waitingDiv.className = 'aab-waiting';
            waitingDiv.style.cssText = 'color:#888; font-size:12px;';
            waitingDiv.textContent = 'Scanning for conversations...';
            container.appendChild(waitingDiv);
        }
        return;
    }

    const waiting = container.querySelector('.aab-waiting');
    if (waiting) waiting.remove();

    const currentSlots = Array.from(container.querySelectorAll('.aab-slot'));

    currentSlots.forEach(slot => {
        const name = slot.getAttribute('data-name');
        if (!tabNames.includes(name)) slot.remove();
    });

    tabNames.forEach(name => {
        if (!startTimes[name]) startTimes[name] = Date.now();
        const elapsed = Date.now() - startTimes[name];
        const done = completions[name] === true || completions[name] === 'done';

        const stateClass = done ? 'done' : 'processing';
        const statusText = done ? 'COMPLETED' : 'IN PROGRESS';

        let slot = container.querySelector(`.aab-slot[data-name="${name}"]`);

        if (!slot) {
            slot = document.createElement('div');
            slot.className = `aab-slot ${stateClass}`;
            slot.setAttribute('data-name', name);

            const header = document.createElement('div');
            header.className = 'aab-header';

            const nameSpan = document.createElement('span');
            nameSpan.className = 'aab-name';
            nameSpan.textContent = name;
            header.appendChild(nameSpan);

            const statusSpan = document.createElement('span');
            statusSpan.className = 'aab-status';
            statusSpan.textContent = statusText;
            header.appendChild(statusSpan);

            const timeSpan = document.createElement('span');
            timeSpan.className = 'aab-time';
            timeSpan.style.opacity = '0.5';
            timeSpan.textContent = formatDuration(elapsed);
            header.appendChild(timeSpan);

            slot.appendChild(header);

            const track = document.createElement('div');
            track.className = 'aab-progress-track';

            const fill = document.createElement('div');
            fill.className = 'aab-progress-fill';
            track.appendChild(fill);

            slot.appendChild(track);
            container.appendChild(slot);
        } else {
            
            slot.className = `aab-slot ${stateClass}`;

            const statusSpan = slot.querySelector('.aab-status');
            if (statusSpan) statusSpan.textContent = statusText;

            const timeSpan = slot.querySelector('.aab-time');
            if (timeSpan) timeSpan.textContent = formatDuration(elapsed);
        }
    });
}

export function hideOverlay() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
        console.log('[Overlay] Hiding overlay...');
        overlay.classList.remove('visible');
        setTimeout(() => overlay.remove(), 300);
    }
}

export function manageOverlay() {
    updateOverlay();
}
