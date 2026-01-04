
/**
 * FULL CDP CORE BUNDLE (TypeScript Port)
 * Monolithic script for browser-side injection.
 * Combines utils, auto-accept, overlay, background polls, and lifecycle management.
 * 
 * Features Parity with Competitor:
 * - Analytics & ROI
 * - Robust Overlay UI with Status
 * - Process/Tab Detection (Cursor & VSCode)
 * - Auto-looping through tabs
 * - Completion State Detection (Good/Bad badges)
 * - Banned Command Protection
 */

export const FULL_CDP_SCRIPT = `
(function () {
    "use strict";

    // Guard: Bail out immediately if not in a browser context
    if (typeof window === 'undefined') return;

    // ============================================================
    // ANALYTICS MODULE
    // ============================================================
    const Analytics = (function () {
        const TERMINAL_KEYWORDS = ['run', 'execute', 'command', 'terminal'];
        
        const ActionType = {
            FILE_EDIT: 'file_edit',
            TERMINAL_COMMAND: 'terminal_command'
        };

        function createDefaultStats() {
            return {
                clicksThisSession: 0,
                blockedThisSession: 0,
                sessionStartTime: null,
                fileEditsThisSession: 0,
                terminalCommandsThisSession: 0,
                actionsWhileAway: 0,
                isWindowFocused: true,
                lastConversationUrl: null,
                lastConversationStats: null
            };
        }

        function getStats() {
            return window.__antigravityPlus?.stats || createDefaultStats();
        }

        function getStatsMutable() {
             if (!window.__antigravityPlus) window.__antigravityPlus = {};
             if (!window.__antigravityPlus.stats) window.__antigravityPlus.stats = createDefaultStats();
            return window.__antigravityPlus.stats;
        }

        function categorizeClick(buttonText) {
            const text = (buttonText || '').toLowerCase();
            for (const keyword of TERMINAL_KEYWORDS) {
                if (text.includes(keyword)) return ActionType.TERMINAL_COMMAND;
            }
            return ActionType.FILE_EDIT;
        }

        function trackClick(buttonText, log) {
            const stats = getStatsMutable();
            stats.clicksThisSession++;
            log(\`[Stats] Click tracked. Total: \${stats.clicksThisSession}\`);

            const category = categorizeClick(buttonText);
            if (category === ActionType.TERMINAL_COMMAND) {
                stats.terminalCommandsThisSession++;
            } else {
                stats.fileEditsThisSession++;
            }

            if (!stats.isWindowFocused) {
                stats.actionsWhileAway++;
            }
        }

        function trackBlocked(log) {
            const stats = getStatsMutable();
            stats.blockedThisSession++;
            log(\`[Stats] Blocked. Total: \${stats.blockedThisSession}\`);
        }

        function initialize(log) {
            if (!window.__antigravityPlus) {
                window.__antigravityPlus = {
                    config: { denyList: [], allowList: [], clickInterval: 1000 },
                    isRunning: false,
                    tabNames: [],
                    completionStatus: {}, // { 'TabName': 'working' | 'done' }
                    sessionID: 0,
                    stats: createDefaultStats(),
                    setConfig: function(cfg) { this.config = { ...this.config, ...cfg }; },
                    start: function(cfg) {
                        this.setConfig(cfg);
                        this.isRunning = true;
                        this.sessionID = Date.now();
                        // Determine ENV (Cursor vs VSCode) - simplified assumption or pass via config
                        // For now, we launch the dual-loop which checks both strategies if needed, 
                        // or default to 'cursorLoop' as it seems more robust for tabs.
                        if (window.__antigravityPlusLoop) window.__antigravityPlusLoop(this.sessionID);
                    },
                    stop: function() { this.isRunning = false; }
                };
            }
             
            if (!window.__antigravityPlus.stats.sessionStartTime) {
                window.__antigravityPlus.stats.sessionStartTime = Date.now();
            }
            log('[Analytics] Initialized');
        }

        return {
            initialize,
            trackClick,
            trackBlocked,
            getStats
        };
    })();

    // --- LOGGING ---
    const log = (msg) => {
        console.log(\`[AntigravityPlus] \${msg}\`);
    };

    Analytics.initialize(log);

    // --- UTILS ---
    const getDocuments = (root = document) => {
        let docs = [root];
        try {
            const iframes = root.querySelectorAll('iframe, frame');
            for (const iframe of iframes) {
                try {
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                    if (iframeDoc) docs.push(...getDocuments(iframeDoc));
                } catch (e) { }
            }
        } catch (e) { }
        return docs;
    };

    const queryAll = (selector) => {
        const results = [];
        getDocuments().forEach(doc => {
            try { results.push(...Array.from(doc.querySelectorAll(selector))); } catch (e) { }
        });
        return results;
    };

    // Helper to strip time suffixes like "3m", "4h", "12s"
    const stripTimeSuffix = (text) => {
        return (text || '').trim().replace(/\\s*\\d+[smh]$/, '').trim();
    };

    // Helper to deduplicate tab names by appending (2), (3), etc.
    const deduplicateNames = (names) => {
        const counts = {};
        return names.map(name => {
            if (counts[name] === undefined) {
                counts[name] = 1;
                return name;
            } else {
                counts[name]++;
                return \`\${name} (\${counts[name]})\`;
            }
        });
    };

    const updateTabNames = (tabs) => {
        const rawNames = Array.from(tabs).map(tab => stripTimeSuffix(tab.textContent));
        const tabNames = deduplicateNames(rawNames);

        // Simple check to avoid spamming logs
        if (JSON.stringify(window.__antigravityPlus.tabNames) !== JSON.stringify(tabNames)) {
            log(\`updateTabNames: Detected \${tabNames.length} tabs: \${tabNames.join(', ')}\`);
            window.__antigravityPlus.tabNames = tabNames;
        }
    };

    // --- OVERLAY LOGIC ---
    const OVERLAY_ID = '__antigravityPlusOverlay';
    const STYLE_ID = '__antigravityPlusStyles';
    const STYLES = \`
        #\${OVERLAY_ID} { position: fixed; background: rgba(0, 0, 0, 0.9); z-index: 2147483647; font-family: sans-serif; color: #fff; display: flex; flex-direction: column; justify-content: flex-start; align-items: stretch; pointer-events: none; opacity: 0; transition: opacity 0.3s; padding: 10px; border-radius: 8px; top: 10px; right: 10px; min-width: 200px; }
        #\${OVERLAY_ID}.visible { opacity: 1; }
        .ag-stat { font-size: 12px; margin: 2px 0; display: flex; justify-content: space-between; }
        .ag-stat span { color: #a855f7; font-weight: bold; }
        .ag-active { color: #22c55e; margin-bottom: 5px; font-weight: bold; text-align: center; border-bottom: 1px solid #333; padding-bottom: 5px; }
        
        .ag-slot { margin-top: 5px; background: rgba(255,255,255,0.05); padding: 4px; border-radius: 4px; }
        .ag-slot-header { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 2px; }
        .ag-progress { height: 3px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden; }
        .ag-fill { height: 100%; width: 0%; transition: width 0.3s, background 0.3s; background: #6b7280; }
        
        .ag-slot.working .ag-fill { background: #a855f7; width: 66%; }
        .ag-slot.done .ag-fill { background: #22c55e; width: 100%; }
        .ag-slot.working .status { color: #a855f7; }
        .ag-slot.done .status { color: #22c55e; }
    \`;

    function updateOverlay() {
        if (!document.getElementById(STYLE_ID)) {
            const style = document.createElement('style');
            style.id = STYLE_ID;
            style.textContent = STYLES;
            document.head.appendChild(style);
        }

        let overlay = document.getElementById(OVERLAY_ID);
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = OVERLAY_ID;
            document.body.appendChild(overlay);
            requestAnimationFrame(() => overlay.classList.add('visible'));
        }

        const stats = Analytics.getStats();
        const state = window.__antigravityPlus || {};
        const isRunning = state.isRunning;
        const tabNames = state.tabNames || [];

        let tabHtml = '';
        if (tabNames.length > 0) {
            tabHtml = tabNames.map(name => {
                const status = state.completionStatus[name] || 'working';
                const isDone = status === 'done';
                return \`
                    <div class="ag-slot \${status}">
                        <div class="ag-slot-header">
                            <span>\${name}</span>
                            <span class="status">\${isDone ? 'DONE' : 'BUSY'}</span>
                        </div>
                        <div class="ag-progress"><div class="ag-fill"></div></div>
                    </div>
                \`;
            }).join('');
        } else {
            tabHtml = '<div style="font-size:10px; color:#666; text-align:center; margin-top:5px;">Scanning tabs...</div>';
        }

        overlay.innerHTML = \`
            <div class="ag-active">\${isRunning ? '● ACTIVE' : '○ PAUSED'}</div>
            <div class="ag-stat">Clicks: <span>\${stats.clicksThisSession}</span></div>
            <div class="ag-stat">Blocked: <span>\${stats.blockedThisSession}</span></div>
            <div style="border-top:1px solid #333; margin:5px 0;"></div>
            \${tabHtml}
        \`;
    }

    // --- BANNED COMMAND DETECTION ---
    function findNearbyCommandText(el) {
        const commandSelectors = ['pre', 'code', 'pre code'];
        let commandText = '';
        let container = el.parentElement;
        let depth = 0;
        const maxDepth = 10;

        while (container && depth < maxDepth) {
            let sibling = container.previousElementSibling;
            let count = 0;
            while (sibling && count < 5) {
                if (sibling.tagName === 'PRE' || sibling.tagName === 'CODE') {
                    commandText += ' ' + sibling.textContent.trim();
                }
                for (const selector of commandSelectors) {
                    const codes = sibling.querySelectorAll(selector);
                    codes.forEach(c => commandText += ' ' + c.textContent.trim());
                }
                sibling = sibling.previousElementSibling;
                count++;
            }
            if (commandText.length > 10) break;
            container = container.parentElement;
            depth++;
        }
        return commandText.trim().toLowerCase();
    }

    function isBanned(text, denyList) {
        if (!denyList || denyList.length === 0) return false;
        const lower = text.toLowerCase();
        for (const pattern of denyList) {
            if (lower.includes(pattern.toLowerCase())) return true;
        }
        return false;
    }

    // --- CLICK LOGIC ---
    function isAcceptButton(el) {
        const text = (el.textContent || "").trim().toLowerCase();
        if (text.length === 0 || text.length > 50) return false;
        
        // Allowed keywords
        const patterns = ['accept', 'run', 'execute', 'confirm', 'allow'];
        // Rejected keywords
        const rejects = ['skip', 'reject', 'cancel', 'close', 'refine'];
        
        if (rejects.some(r => text.includes(r))) return false;
        if (!patterns.some(p => text.includes(p))) return false;

        // Banned check
        const config = window.__antigravityPlus?.config || {};
        if (config.denyList && config.denyList.length > 0) {
            const cmdText = findNearbyCommandText(el);
            if (isBanned(cmdText, config.denyList)) {
                log(\`[BANNED] Skipping button "\${text}" due to banned command context\`);
                Analytics.trackBlocked(log);
                return false;
            }
        }

        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.display !== 'none' && rect.width > 0 && style.pointerEvents !== 'none' && !el.disabled;
    }

    function waitForDisappear(el, timeout = 500) {
        return new Promise(resolve => {
            const start = Date.now();
            const check = () => {
                if (!el.isConnected || el.style.display === 'none') resolve(true);
                else if (Date.now() - start > timeout) resolve(false);
                else requestAnimationFrame(check);
            };
            setTimeout(check, 50);
        });
    }

    async function performClick() {
        // Broad selector search like competitor
        const selectors = ['button', '[class*="button"]', '[class*="anysphere"]'];
        const found = [];
        selectors.forEach(s => queryAll(s).forEach(e => found.push(e)));
        const unique = [...new Set(found)];

        let clicked = 0;
        
        for (const btn of unique) {
            if (isAcceptButton(btn)) {
                const text = btn.textContent.trim();
                log(\`Clicking: "\${text}"\`);
                btn.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));
                
                const hidden = await waitForDisappear(btn);
                if (hidden) {
                    Analytics.trackClick(text, log);
                    clicked++;
                }
            }
        }
        return clicked;
    }

    // --- MAIN LOOPS ---
    
    // Logic to detect if a specific tab seems "done" (Good/Bad badges)
    // Competitor uses specific span text detection
    function checkCompletion(tabName) {
        if (!tabName) return;
        const allSpans = queryAll('span');
        const feedback = allSpans.some(s => {
            const t = s.textContent.trim();
            return t === 'Good' || t === 'Bad';
        });
        
        if (feedback) {
            window.__antigravityPlus.completionStatus[tabName] = 'done';
        } else {
            // Default to working if not done, but don't overwrite if already done? 
            // Competitor overwrites. Safe to overwrite.
            window.__antigravityPlus.completionStatus[tabName] = 'working';
        }
    }

    window.__antigravityPlusLoop = async function(sid) {
        log('Loop STARTED');
        let index = 0;
        let cycle = 0;

        while (window.__antigravityPlus.isRunning && window.__antigravityPlus.sessionID === sid) {
            cycle++;
            try {
                // 1. Perform Clicks on current view
                await performClick();

                // 2. Discover Tabs (Competitor Selectors)
                const tabSelectors = [
                    '#workbench\\\\.parts\\\\.auxiliarybar ul[role="tablist"] li[role="tab"]',
                    '.monaco-pane-view .monaco-list-row[role="listitem"]',
                    'div[role="tablist"] div[role="tab"]',
                    '.chat-session-item'
                ];
                
                let tabs = [];
                for (const sel of tabSelectors) {
                    tabs = queryAll(sel);
                    if (tabs.length > 0) break;
                }

                updateTabNames(tabs);
                
                // 3. Check completion status of CURRENT tab (heuristic: look for badges in current view)
                // We assume current view corresponds to the 'current' tab being processed or last clicked.
                // It's hard to associate DOM Badge with Tab Name without strict DOM hierarchy.
                // Heuristic: if badges found, mark *current active* tab as done.
                // Finding active tab:
                const activeTab = tabs.find(t => t.getAttribute('aria-selected') === 'true' || t.classList.contains('active'));
                if (activeTab) {
                    const name = stripTimeSuffix(activeTab.textContent);
                    checkCompletion(name);
                }

                // 4. Loop Logic (Switch Tabs)
                // Only switch if we have multiple tabs and configured to do so?
                // Competitor ALWAYS switches.
                if (tabs.length > 0) {
                    const targetTab = tabs[index % tabs.length];
                    // Don't switch if we are interacting? Or just switch blindly like competitor?
                    // Competitor switches every 3s (wait at end of loop).
                    
                    // Click tab to switch
                    // targetTab.dispatchEvent(new MouseEvent('click', ...));
                    // index++;
                    
                    // For safety in this port, let's just log existence. 
                    // To strictly match competitor:
                     if (cycle % 3 === 0) { // Slower switching than clicking
                        const name = stripTimeSuffix(targetTab.textContent);
                        log(\`Switching to tab: \${name}\`);
                        targetTab.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));
                        index++;
                     }
                }

                updateOverlay();
            } catch (e) {
                log(\`Loop Error: \${e}\`);
            }
            
            const interval = window.__antigravityPlus.config.clickInterval || 1000;
            await new Promise(r => setTimeout(r, interval));
        }
        log('Loop STOPPED');
    };

    // Auto-start if configured (e.g. re-injection)
    if (window.__antigravityPlus && window.__antigravityPlus.isRunning) {
        window.__antigravityPlusLoop(window.__antigravityPlus.sessionID);
    }
})();
`;
