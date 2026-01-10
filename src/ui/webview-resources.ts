export const ANTIGRAVITY_AUTH_UI_SCRIPT = `
/**
 * Antigravity Plus - Shared Authentication UI
 * Refactored for Plus Theme (Dark Purple)
 */

(function () {
    'use strict';

    // I18n Helper
    const i18n = window.__i18n || {};
    const t = (key) => i18n[key] || key;

    class PlusAuthUI {
        constructor(vscodeApi) {
            this.vscode = vscodeApi;
            this.state = {
                authorization: null
            };
        }

        updateState(authorization) {
            this.state.authorization = authorization;
        }

        /**
         * Render the Auth Row
         * @param {HTMLElement} container
         */
        renderAuthRow(container) {
            if (!container) return;

            const { authorization } = this.state;
            const accounts = authorization?.accounts || [];
            const hasAccounts = accounts.length > 0;
            const activeAccount = authorization?.activeAccount;
            const activeEmail = activeAccount || (hasAccounts ? accounts[0].email : null);
            const isAuthorized = authorization?.isAuthorized || hasAccounts;

            // Manage Button (Glassmorphism style)
            const manageBtn = \`<button class="plus-btn-icon" title="\${t('autoTrigger.manageAccounts') || 'Manage Accounts'}">⚙️</button>\`;

            if (isAuthorized && activeEmail) {
                const extraCount = Math.max(accounts.length - 1, 0);
                const accountCountBadge = extraCount > 0
                    ? \`<span class="account-badge" title="\${extraCount} more accounts">+\${extraCount}</span>\`
                    : '';

                container.innerHTML = \`
                    <div class="auth-info-group clickable" id="auth-info-trigger">
                        <div class="auth-status-icon success">✓</div>
                        <div class="auth-details">
                            <span class="auth-label">\${t('autoTrigger.authorized') || 'Authorized'}</span>
                            <span class="auth-email">\${activeEmail}</span>
                        </div>
                        \${accountCountBadge}
                    </div>
                    <div class="auth-actions">
                        \${manageBtn}
                    </div>
                 \`;
            } else {
                // Unauthorized
                container.innerHTML = \`
                    <div class="auth-info-group">
                        <div class="auth-status-icon warning">!</div>
                        <div class="auth-details">
                            <span class="auth-label">\${t('autoTrigger.unauthorized') || 'Antigravity Account'}</span>
                            <span class="auth-sublabel">\${t('autoTrigger.signInPrompt') || 'Sign in to sync quota'}</span>
                        </div>
                    </div>
                    <div class="auth-actions">
                        <button class="plus-btn plus-btn-primary" id="btn-authorize">\${t('autoTrigger.authorizeBtn') || 'Sign In'}</button>
                    </div>
                \`;
            }

            this._bindEvents(container);
        }

        _bindEvents(container) {
            // Manage triggered by whole info group or specific button
            container.querySelector('#auth-info-trigger')?.addEventListener('click', () => this.openAccountManageModal());
            container.querySelector('.plus-btn-icon')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openAccountManageModal();
            });

            // Authorize
            container.querySelector('#btn-authorize')?.addEventListener('click', () => {
                this.vscode.postMessage({ command: 'autoTrigger.authorize' });
            });
        }

        // ============ Modals ============

        openAccountManageModal() {
            let modal = document.getElementById('plus-account-modal');
            if (!modal) {
                modal = this._createModal('plus-account-modal', \`
                    <div class="plus-modal-content">
                        <div class="plus-modal-header">
                            <h3>\${t('autoTrigger.manageAccounts') || 'Manage Accounts'}</h3>
                            <button class="plus-close-btn" id="close-account-modal">×</button>
                        </div>
                        <div class="plus-modal-body" id="account-list-body"></div>
                        <div class="plus-modal-footer">
                            <button id="btn-add-account" class="plus-btn plus-btn-secondary">➕ \${t('autoTrigger.addAccount') || 'Add Account'}</button>
                        </div>
                    </div>
                \`);
                
                document.getElementById('close-account-modal')?.addEventListener('click', () => modal.classList.add('hidden'));
                document.getElementById('btn-add-account')?.addEventListener('click', () => {
                    this.vscode.postMessage({ command: 'autoTrigger.addAccount' });
                });
            }

            this.renderAccountList();
            modal.classList.remove('hidden');
        }

        renderAccountList() {
            const body = document.getElementById('account-list-body');
            if (!body) return;

            const accounts = this.state.authorization?.accounts || [];
            const activeAccount = this.state.authorization?.activeAccount;

            if (accounts.length === 0) {
                body.innerHTML = \`<div class="empty-state">\${t('autoTrigger.noAccounts') || 'No accounts found'}</div>\`;
                return;
            }

            body.innerHTML = \`<div class="account-list">\${accounts.map(acc => {
                const isActive = acc.email === activeAccount;
                const isInvalid = acc.isInvalid === true;
                
                return \`
                    <div class="account-item \${isActive ? 'active' : ''} \${isInvalid ? 'expired' : ''}" data-email="\${acc.email}">
                        <div class="account-avatar">\${acc.email.charAt(0).toUpperCase()}</div>
                        <div class="account-info-col">
                            <div class="account-email">\${acc.email}</div>
                            \${isInvalid ? '<div class="account-status error">Session Expired</div>' : (isActive ? '<div class="account-status success">Active</div>' : '')}
                        </div>
                        <div class="account-actions-col">
                             <button class="plus-mini-btn btn-reauth" data-email="\${acc.email}" title="Reauthorize">🔄</button>
                             <button class="plus-mini-btn btn-remove" data-email="\${acc.email}" title="Sign Out">🚪</button>
                        </div>
                    </div>
                \`;
            }).join('')}</div>\`;

            // Event Delegation
            body.onclick = (e) => {
                const target = e.target;
                const item = target.closest('.account-item');
                if (!item) return;
                
                const email = item.dataset.email;

                if (target.closest('.btn-reauth')) {
                    this.vscode.postMessage({ command: 'autoTrigger.reauthorizeAccount', email });
                } else if (target.closest('.btn-remove')) {
                    this.vscode.postMessage({ command: 'autoTrigger.removeAccount', email });
                } else if (item && !item.classList.contains('active')) {
                     // Switch account
                     this.vscode.postMessage({ command: 'autoTrigger.switchAccount', email });
                     document.getElementById('plus-account-modal')?.classList.add('hidden');
                }
            };
        }

        _createModal(id, html) {
            const modal = document.createElement('div');
            modal.id = id;
            modal.className = 'plus-modal-overlay hidden';
            modal.innerHTML = html;
            document.body.appendChild(modal);
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.classList.add('hidden');
            });
            return modal;
        }
    }

    // Export with new name
    window.PlusAuthUI = PlusAuthUI;

})();
`;

export const AUTH_UI_CSS = `
/* ============ Plus Theme Auth UI ============ */
:root {
    --plus-primary: #667eea;
    --plus-primary-hover: #5a6fd6;
    --plus-bg-glass: rgba(255, 255, 255, 0.05);
    --plus-border-glass: rgba(255, 255, 255, 0.1);
    --plus-text-main: #e0e0e0;
    --plus-text-sub: #888;
    --plus-success: #4ade80;
    --plus-warning: #fbbf24;
    --plus-danger: #ef4444;
}

.quota-auth-card {
    background: var(--plus-bg-glass);
    border: 1px solid var(--plus-border-glass);
    border-radius: 12px;
    padding: 12px 16px;
    margin-bottom: 20px;
    backdrop-filter: blur(10px);
    transition: transform 0.2s ease, border-color 0.2s ease;
}

.quota-auth-card:hover {
    border-color: var(--plus-primary);
    transform: translateY(-1px);
}

.quota-auth-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

/* Info Group */
.auth-info-group {
    display: flex;
    align-items: center;
    gap: 12px;
}

.auth-info-group.clickable {
    cursor: pointer;
    border-radius: 8px;
    padding: 4px 8px;
    margin-left: -8px;
    transition: background 0.2s;
}

.auth-info-group.clickable:hover {
    background: rgba(255, 255, 255, 0.05);
}

.auth-status-icon {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 14px;
    flex-shrink: 0;
}

.auth-status-icon.success {
    background: rgba(74, 222, 128, 0.2);
    color: var(--plus-success);
    border: 1px solid rgba(74, 222, 128, 0.3);
}

.auth-status-icon.warning {
    background: rgba(251, 191, 36, 0.2);
    color: var(--plus-warning);
    border: 1px solid rgba(251, 191, 36, 0.3);
}

.auth-details {
    display: flex;
    flex-direction: column;
}

.auth-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--plus-text-main);
}

.auth-sublabel, .auth-email {
    font-size: 11px;
    color: var(--plus-text-sub);
}

.account-badge {
    background: var(--plus-primary);
    color: white;
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 10px;
    font-weight: bold;
}

/* Actions */
.auth-actions {
    display: flex;
    gap: 8px;
}

.plus-btn {
    padding: 6px 14px;
    border: none;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
}

.plus-btn-primary {
    background: var(--plus-primary);
    color: white;
}

.plus-btn-primary:hover {
    background: var(--plus-primary-hover);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.plus-btn-secondary {
    background: transparent;
    border: 1px solid var(--plus-border-glass);
    color: var(--plus-text-main);
}

.plus-btn-secondary:hover {
    border-color: var(--plus-primary);
    color: var(--plus-primary);
}

.plus-btn-icon {
    background: transparent;
    border: none;
    font-size: 16px;
    cursor: pointer;
    color: var(--plus-text-sub);
    padding: 4px;
    border-radius: 4px;
    transition: all 0.2s;
}

.plus-btn-icon:hover {
    color: var(--plus-primary);
    background: rgba(102, 126, 234, 0.1);
}

/* Modal */
.plus-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    z-index: 100;
    display: flex;
    justify-content: center;
    align-items: center;
}

.plus-modal-overlay.hidden {
    display: none;
}

.plus-modal-content {
    background: #1a1a2e; /* Match Dashboard Body BG approx */
    background: linear-gradient(135deg, #1e2040 0%, #17182f 100%);
    border: 1px solid var(--plus-border-glass);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    border-radius: 12px;
    width: 400px;
    max-width: 90vw;
    display: flex;
    flex-direction: column;
}

.plus-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    border-bottom: 1px solid var(--plus-border-glass);
}

.plus-modal-header h3 {
    margin: 0;
    font-size: 14px;
    color: var(--plus-text-main);
}

.plus-close-btn {
    background: none;
    border: none;
    color: var(--plus-text-sub);
    font-size: 20px;
    cursor: pointer;
}

.plus-modal-body {
    padding: 16px;
    max-height: 300px;
    overflow-y: auto;
}

.plus-modal-footer {
    padding: 16px;
    border-top: 1px solid var(--plus-border-glass);
    display: flex;
    justify-content: flex-end;
}

/* Account List */
.account-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.account-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid transparent;
    cursor: pointer;
    transition: all 0.2s;
}

.account-item:hover {
    background: rgba(255, 255, 255, 0.05);
}

.account-item.active {
    border-color: var(--plus-primary);
    background: rgba(102, 126, 234, 0.1);
}

.account-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 14px;
}

.account-info-col {
    flex: 1;
    overflow: hidden;
}

.account-email {
    font-size: 13px;
    color: var(--plus-text-main);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.account-status {
    font-size: 10px;
    margin-top: 2px;
}

.account-status.success { color: var(--plus-success); }
.account-status.error { color: var(--plus-danger); }

.account-actions-col {
    display: flex;
    gap: 4px;
}

.plus-mini-btn {
    background: transparent;
    border: none;
    font-size: 14px;
    padding: 6px;
    border-radius: 4px;
    cursor: pointer;
    opacity: 0.6;
    transition: all 0.2s;
}

.plus-mini-btn:hover {
    opacity: 1;
    background: rgba(255, 255, 255, 0.1);
}

.empty-state {
    text-align: center;
    color: var(--plus-text-sub);
    padding: 20px;
    font-style: italic;
    font-size: 12px;
}
`;
