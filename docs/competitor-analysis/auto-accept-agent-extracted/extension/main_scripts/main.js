// instantiate gloabl state tracker with default fallback
window.__autoAcceptState = window.__autoAcceptState || {
    isRunning: false,
    tabNames: [],
    completionStatus: {},
    sessionID: 0,
    currentMode: null
};

// define global functions

window.__autoAcceptStart = function (config) {
    // Check if we need to restart due to mode change
    const newMode = (config.isBackgroundMode && config.isPro) ? 'background' : 'simple';
    if (window.__autoAcceptState.isRunning && window.__autoAcceptState.currentMode === newMode) {
        return; // Already running in the correct mode
    }

    // Stop existing if any
    if (window.__autoAcceptState.isRunning) {
        window.__autoAcceptStop();
    }

    window.__autoAcceptState.isRunning = true;
    window.__autoAcceptState.currentMode = newMode;
    window.__autoAcceptState.sessionID++;

    if (newMode === 'background') {
        const ide = config.ide ? config.ide.toLowerCase() : '';
        if (ide === 'antigravity') {
            antigravityBackgroundPoll();
        } else if (ide === 'cursor') {
            cursorBackgroundPoll();
        } else {
            console.error('[AutoAccept] Unknown IDE for background mode:', config.ide);
        }
    } else {
        startSimpleCycle(config);
    }
};

window.__autoAcceptStop = function () {
    window.__autoAcceptState.isRunning = false;
    // Reset the global state fields
    window.__autoAcceptState.currentMode = null;
    window.__autoAcceptState.tabNames = [];
    window.__autoAcceptState.completionStatus = {};
    window.__autoAcceptState.sessionID = 0;

    if (typeof hideOverlay === 'function') hideOverlay();

};

function startSimpleCycle(config) {
    const ide = config.ide ? config.ide.toLowerCase() : '';
    const buttons = ide === 'cursor' ? ['run'] : ['accept', 'retry'];
    const sid = window.__autoAcceptState.sessionID;
    function step() {
        if (!window.__autoAcceptState.isRunning || window.__autoAcceptState.sessionID !== sid) {
            return;
        }
        autoAccept(buttons);
        setTimeout(step, config.pollInterval || 1000);
    }
    step();
}
