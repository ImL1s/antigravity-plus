export function assert(condition, message) {
    if (!condition) {
        throw new Error(message || "Assertion failed")
    }
}

export function getIDEName() {
    // Node side detection
    if (typeof vscode !== 'undefined' && vscode.env) {
        const appName = vscode.env.appName || '';
        if (appName.toLowerCase().includes('cursor')) return 'Cursor';
        if (appName.toLowerCase().includes('antigravity')) return 'Antigravity';
    }
    // Browser side detection
    if (typeof document !== 'undefined') {
        const title = document.title.toLowerCase();
        if (title.includes('cursor')) return 'Cursor';
        if (title.includes('antigravity') || !!document.getElementById('antigravity.agentPanel')) return 'Antigravity';
    }
    return 'Unknown';
}

export function updateTabNames(tabs) {
    if (!tabs || tabs.length === 0) return

    const tabNames = Array.from(tabs).map(tab => tab.textContent.trim())

    // Only update if the content actually changed to save resources
    const currentState = window.__autoAcceptState
    if (currentState && JSON.stringify(currentState.tabNames) === JSON.stringify(tabNames)) {
        return
    }

    window.__autoAcceptState = {
        ...window.__autoAcceptState,
        tabNames: tabNames,
        lastUpdated: Date.now()
    }
}

export function updateConversationCompletionState(tabName, isCompleted) {
    const currentState = window.__autoAcceptState || { completionStatus: {} }
    const currentStatus = currentState.completionStatus || {}

    // Optimize: Only update if changed
    if (currentStatus[tabName] === isCompleted) return

    window.__autoAcceptState = {
        ...currentState,
        completionStatus: {
            ...currentStatus,
            [tabName]: isCompleted
        },
        lastUpdated: Date.now()
    }
}

/**
 * Recursively find all accessible documents (main document + iframes)
 */
export function getDocuments(root = document) {
    let docs = [root];
    try {
        const iframes = root.querySelectorAll('iframe, frame');
        for (const iframe of iframes) {
            try {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                if (iframeDoc) {
                    docs.push(...getDocuments(iframeDoc));
                }
            } catch (e) {
                // Cross-origin iframe
            }
        }
    } catch (e) {
        // Ignore errors
    }
    return docs;
}

/**
 * Query all matching elements across all accessible documents
 */
export function queryAll(selector) {
    const docs = getDocuments();
    let results = [];
    for (const doc of docs) {
        results.push(...Array.from(doc.querySelectorAll(selector)));
    }
    return results;
}