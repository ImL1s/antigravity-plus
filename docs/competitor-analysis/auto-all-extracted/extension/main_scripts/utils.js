export function assert(condition, message) {
    if (!condition) {
        throw new Error(message || "Assertion failed")
    }
}

export function getIDEName() {
    
    if (typeof vscode !== 'undefined' && vscode.env) {
        const appName = vscode.env.appName || '';
        if (appName.toLowerCase().includes('cursor')) return 'Cursor';
        if (appName.toLowerCase().includes('antigravity')) return 'Antigravity';
    }
    
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

    const currentState = window.__autoAllState
    if (currentState && JSON.stringify(currentState.tabNames) === JSON.stringify(tabNames)) {
        return
    }

    window.__autoAllState = {
        ...window.__autoAllState,
        tabNames: tabNames,
        lastUpdated: Date.now()
    }
}

export function updateConversationCompletionState(tabName, isCompleted) {
    const currentState = window.__autoAllState || { completionStatus: {} }
    const currentStatus = currentState.completionStatus || {}

    if (currentStatus[tabName] === isCompleted) return

    window.__autoAllState = {
        ...currentState,
        completionStatus: {
            ...currentStatus,
            [tabName]: isCompleted
        },
        lastUpdated: Date.now()
    }
}

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
                
            }
        }
    } catch (e) {
        
    }
    return docs;
}

export function queryAll(selector) {
    const docs = getDocuments();
    let results = [];
    for (const doc of docs) {
        results.push(...Array.from(doc.querySelectorAll(selector)));
    }
    return results;
}