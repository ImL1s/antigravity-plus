/**
 * Analytics Module - Main Orchestrator
 * 
 * High-level interface for all analytics functionality.
 * This module wires together the state, trackers, reporters, and focus management.
 * 
 * @module analytics
 * 
 * Architecture:
 * ┌─────────────────────────────────────────────────────────────┐
 * │                      analytics/index.js                      │
 * │                     (Main Orchestrator)                      │
 * └───────────────────────────┬─────────────────────────────────┘
 *                             │
 *         ┌───────────────────┼───────────────────┐
 *         │                   │                   │
 *         ▼                   ▼                   ▼
 * ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
 * │   state.js   │   │   focus.js   │   │  trackers/   │
 * │ (Init/Migrate)│   │ (Focus/Blur) │   │  reporters/  │
 * └──────────────┘   └──────────────┘   └──────────────┘
 */

// For browser injection, we inline the modules.
// For Node.js testing, we use require().

(function (exports) {
    'use strict';

    // ==========================================
    // STATE MANAGEMENT
    // ==========================================

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
        return window.__autoAcceptState?.stats || createDefaultStats();
    }

    function getStatsMutable() {
        return window.__autoAcceptState.stats;
    }

    // ==========================================
    // CLICK TRACKING
    // ==========================================

    const ActionType = {
        FILE_EDIT: 'file_edit',
        TERMINAL_COMMAND: 'terminal_command'
    };

    const TERMINAL_KEYWORDS = ['run', 'execute', 'command', 'terminal'];

    function categorizeClick(buttonText) {
        const text = (buttonText || '').toLowerCase();
        for (const keyword of TERMINAL_KEYWORDS) {
            if (text.includes(keyword)) {
                return ActionType.TERMINAL_COMMAND;
            }
        }
        return ActionType.FILE_EDIT;
    }

    /**
     * Track a button click with full categorization and away detection.
     * 
     * @param {string} buttonText - Text of the clicked button
     * @param {Function} log - Logger function
     * @returns {Object} Click metadata
     */
    function trackClick(buttonText, log) {
        const stats = getStatsMutable();

        // Increment total clicks
        stats.clicksThisSession++;
        log(`[Stats] Click tracked. Total: ${stats.clicksThisSession}`);

        // Categorize
        const category = categorizeClick(buttonText);
        if (category === ActionType.TERMINAL_COMMAND) {
            stats.terminalCommandsThisSession++;
            log(`[Stats] Terminal command. Total: ${stats.terminalCommandsThisSession}`);
        } else {
            stats.fileEditsThisSession++;
            log(`[Stats] File edit. Total: ${stats.fileEditsThisSession}`);
        }

        // Away tracking
        let isAway = false;
        if (!stats.isWindowFocused) {
            stats.actionsWhileAway++;
            isAway = true;
            log(`[Stats] Away action. Total away: ${stats.actionsWhileAway}`);
        }

        return { category, isAway, totalClicks: stats.clicksThisSession };
    }

    /**
     * Track a blocked command.
     * 
     * @param {Function} log - Logger function
     */
    function trackBlocked(log) {
        const stats = getStatsMutable();
        stats.blockedThisSession++;
        log(`[Stats] Blocked. Total: ${stats.blockedThisSession}`);
    }

    // ==========================================
    // ROI REPORTING
    // ==========================================

    /**
     * Collect and reset ROI stats for weekly aggregation.
     * Preserves UX notification counters.
     * 
     * @param {Function} log - Logger function
     * @returns {Object} Collected stats
     */
    function collectROI(log) {
        const stats = getStatsMutable();
        const collected = {
            clicks: stats.clicksThisSession || 0,
            blocked: stats.blockedThisSession || 0,
            sessionStart: stats.sessionStartTime
        };

        log(`[ROI] Collected: ${collected.clicks} clicks, ${collected.blocked} blocked`);

        // Reset ONLY core ROI metrics
        stats.clicksThisSession = 0;
        stats.blockedThisSession = 0;
        stats.sessionStartTime = Date.now();

        return collected;
    }

    // ==========================================
    // SESSION SUMMARY
    // ==========================================

    /**
     * Get session summary for end-of-session notifications.
     * 
     * @returns {Object} Session summary with time estimates
     */
    function getSessionSummary() {
        const stats = getStats();
        const clicks = stats.clicksThisSession || 0;

        const baseSecs = clicks * 5;
        const minMins = Math.max(1, Math.floor((baseSecs * 0.8) / 60));
        const maxMins = Math.ceil((baseSecs * 1.2) / 60);

        return {
            clicks,
            fileEdits: stats.fileEditsThisSession || 0,
            terminalCommands: stats.terminalCommandsThisSession || 0,
            blocked: stats.blockedThisSession || 0,
            estimatedTimeSaved: clicks > 0 ? `${minMins}–${maxMins}` : null
        };
    }

    // ==========================================
    // AWAY ACTIONS
    // ==========================================

    /**
     * Get and reset away actions counter.
     * 
     * @param {Function} log - Logger function
     * @returns {number} Actions performed while away
     */
    function consumeAwayActions(log) {
        const stats = getStatsMutable();
        const count = stats.actionsWhileAway || 0;
        log(`[Away] Getting away actions: ${count}`);
        stats.actionsWhileAway = 0;
        return count;
    }

    /**
     * Check if user is currently away (window not focused).
     * 
     * @returns {boolean} True if window not focused
     */
    function isUserAway() {
        return !getStats().isWindowFocused;
    }

    // ==========================================
    // FOCUS MANAGEMENT
    // ==========================================

    let focusListenersAttached = false;

    /**
     * Setup focus/blur listeners.
     * 
     * @param {Function} log - Logger function
     */
    function setupFocusListeners(log) {
        if (typeof window === 'undefined') return;
        if (focusListenersAttached) return;

        log('[Focus] Setting up listeners...');

        const handleFocusChange = (isFocused, source) => {
            const state = window.__autoAcceptState;
            if (!state || !state.stats) return;

            const wasAway = !state.stats.isWindowFocused;
            state.stats.isWindowFocused = isFocused;

            log(`[Focus] ${source}: focused=${isFocused}, wasAway=${wasAway}`);

            if (isFocused && wasAway) {
                const awayActions = state.stats.actionsWhileAway || 0;
                log(`[Focus] User returned! awayActions=${awayActions}`);
                if (awayActions > 0) {
                    window.dispatchEvent(new CustomEvent('autoAcceptUserReturned', {
                        detail: { actionsWhileAway: awayActions }
                    }));
                }
            }
        };

        window.addEventListener('focus', () => handleFocusChange(true, 'window-focus'));
        window.addEventListener('blur', () => handleFocusChange(false, 'window-blur'));
        document.addEventListener('visibilitychange', () =>
            handleFocusChange(!document.hidden, 'visibility-change')
        );

        handleFocusChange(!document.hidden, 'init');
        focusListenersAttached = true;
        log('[Focus] Listeners registered');
    }

    // ==========================================
    // INITIALIZATION
    // ==========================================

    /**
     * Initialize the analytics system.
     * Call this when the CDP script loads.
     * 
     * @param {Function} log - Logger function
     */
    function initialize(log) {
        // Initialize state
        if (!window.__autoAcceptState) {
            window.__autoAcceptState = {
                isRunning: false,
                tabNames: [],
                completionStatus: {},
                sessionID: 0,
                currentMode: null,
                startTimes: {},
                bannedCommands: [],
                isPro: false,
                stats: createDefaultStats()
            };
            log('[Analytics] State initialized');
        } else if (!window.__autoAcceptState.stats) {
            window.__autoAcceptState.stats = createDefaultStats();
            log('[Analytics] Stats added to existing state');
        } else {
            // Migrate existing stats
            const s = window.__autoAcceptState.stats;
            if (s.actionsWhileAway === undefined) s.actionsWhileAway = 0;
            if (s.isWindowFocused === undefined) s.isWindowFocused = true;
            if (s.fileEditsThisSession === undefined) s.fileEditsThisSession = 0;
            if (s.terminalCommandsThisSession === undefined) s.terminalCommandsThisSession = 0;
        }

        // Setup focus listeners
        setupFocusListeners(log);

        // Initialize session start time
        if (!window.__autoAcceptState.stats.sessionStartTime) {
            window.__autoAcceptState.stats.sessionStartTime = Date.now();
        }

        log('[Analytics] Initialized successfully');
    }

    // ==========================================
    // EXPORTS
    // ==========================================

    // Public API
    exports.Analytics = {
        // Initialization
        initialize,

        // Click tracking
        trackClick,
        trackBlocked,
        categorizeClick,
        ActionType,

        // ROI reporting
        collectROI,

        // Session summary
        getSessionSummary,

        // Away actions
        consumeAwayActions,
        isUserAway,

        // State access
        getStats,

        // Focus
        setupFocusListeners
    };

    // Also expose individual functions for backwards compatibility
    exports.trackClick = trackClick;
    exports.trackBlocked = trackBlocked;
    exports.collectROI = collectROI;
    exports.getSessionSummary = getSessionSummary;
    exports.consumeAwayActions = consumeAwayActions;
    exports.initialize = initialize;

})(typeof module !== 'undefined' && module.exports ? module.exports : window);
