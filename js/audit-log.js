/* ============================
   TRANSITPAY - Audit Log
   ============================ */

// ==================== AUDIT LOG CORE ====================

/**
 * Add an entry to the audit log
 * @param {string} action - 'created' | 'updated' | 'deleted' | 'imported' | 'login' | 'logout' | 'migrated'
 * @param {string} module - 'receipt' | 'client' | 'petrol' | 'user' | 'tenant' | 'settings' | 'auth' | 'import'
 * @param {string} description - Human-readable description of what happened
 * @param {object} [details] - Optional extra details (e.g., amount, record ID)
 */
function addAuditLog(action, module, description, details) {
    if (!appData) return;
    if (!appData.auditLog) appData.auditLog = [];

    const userName = appData.user ? (appData.user.name || appData.user.username || 'Unknown') : 'System';
    const tenantCode = window._ACTIVE_TENANT_CODE || 'HOST';

    const entry = {
        id: 'AUD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        action: action,
        module: module,
        description: description,
        details: details || null,
        user: userName,
        tenantCode: tenantCode,
        timestamp: new Date().toISOString()
    };

    // Add to beginning (newest first)
    appData.auditLog.unshift(entry);

    // Keep max 500 entries to prevent data bloat
    if (appData.auditLog.length > 500) {
        appData.auditLog = appData.auditLog.slice(0, 500);
    }

    // Don't save here - let the caller save (to avoid double-saving)
    console.log(`[Audit] ${action.toUpperCase()} | ${module} | ${description}`);
}

// ==================== AUDIT LOG UI ====================

function loadAuditLog() {
    const tbody = document.getElementById('auditLogBody');
    const countEl = document.getElementById('auditLogCount');
    if (!tbody) return;

    const logs = appData.auditLog || [];
    const filterModule = document.getElementById('auditFilterModule')?.value || 'all';
    const filterAction = document.getElementById('auditFilterAction')?.value || 'all';
    const searchTerm = (document.getElementById('auditSearch')?.value || '').toLowerCase();

    // Apply filters
    let filtered = logs;
    if (filterModule !== 'all') {
        filtered = filtered.filter(l => l.module === filterModule);
    }
    if (filterAction !== 'all') {
        filtered = filtered.filter(l => l.action === filterAction);
    }
    if (searchTerm) {
        filtered = filtered.filter(l =>
            l.description.toLowerCase().includes(searchTerm) ||
            l.user.toLowerCase().includes(searchTerm) ||
            l.module.toLowerCase().includes(searchTerm)
        );
    }

    // Show max 100 entries
    const display = filtered.slice(0, 100);

    if (countEl) countEl.textContent = filtered.length;

    if (display.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="5">
                    <div class="empty-state-mini">
                        <p>No audit log entries${filterModule !== 'all' || filterAction !== 'all' || searchTerm ? ' matching filters' : ' yet'}.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = display.map(entry => {
        const time = formatAuditTime(entry.timestamp);
        const actionBadge = getActionBadge(entry.action);
        const moduleIcon = getModuleIcon(entry.module);

        return `
            <tr>
                <td style="white-space:nowrap;font-size:0.8rem;">
                    <div style="color:var(--text-primary);font-weight:500;">${time.date}</div>
                    <div style="color:var(--text-muted);font-size:0.75rem;">${time.time}</div>
                </td>
                <td>${actionBadge}</td>
                <td>
                    <div style="display:flex;align-items:center;gap:0.5rem;">
                        ${moduleIcon}
                        <span style="text-transform:capitalize;font-weight:500;">${entry.module}</span>
                    </div>
                </td>
                <td style="max-width:350px;">
                    <div style="color:var(--text-primary);font-size:0.85rem;">${entry.description}</div>
                    ${entry.details ? `<div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px;">${formatDetails(entry.details)}</div>` : ''}
                </td>
                <td>
                    <div style="display:flex;align-items:center;gap:0.4rem;">
                        <span style="width:24px;height:24px;border-radius:50%;background:var(--primary-500);color:white;display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;">${(entry.user || 'S').charAt(0).toUpperCase()}</span>
                        <span style="font-size:0.8rem;color:var(--text-secondary);">${entry.user}</span>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function formatAuditTime(isoString) {
    const d = new Date(isoString);
    const now = new Date();
    const diff = now - d;

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    let dateStr;
    if (diff < 60000) {
        dateStr = 'Just now';
    } else if (diff < 3600000) {
        dateStr = Math.floor(diff / 60000) + ' min ago';
    } else if (diff < 86400000 && d.getDate() === now.getDate()) {
        dateStr = 'Today';
    } else if (diff < 172800000) {
        dateStr = 'Yesterday';
    } else {
        dateStr = d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
    }

    const hours = d.getHours().toString().padStart(2, '0');
    const mins = d.getMinutes().toString().padStart(2, '0');
    const secs = d.getSeconds().toString().padStart(2, '0');

    return {
        date: dateStr,
        time: `${hours}:${mins}:${secs}`
    };
}

function getActionBadge(action) {
    const badges = {
        created: '<span style="background:#10b98120;color:#10b981;padding:0.2rem 0.6rem;border-radius:12px;font-size:0.72rem;font-weight:600;">CREATED</span>',
        updated: '<span style="background:#3b82f620;color:#3b82f6;padding:0.2rem 0.6rem;border-radius:12px;font-size:0.72rem;font-weight:600;">UPDATED</span>',
        deleted: '<span style="background:#ef444420;color:#ef4444;padding:0.2rem 0.6rem;border-radius:12px;font-size:0.72rem;font-weight:600;">DELETED</span>',
        imported: '<span style="background:#8b5cf620;color:#8b5cf6;padding:0.2rem 0.6rem;border-radius:12px;font-size:0.72rem;font-weight:600;">IMPORTED</span>',
        login: '<span style="background:#06b6d420;color:#06b6d4;padding:0.2rem 0.6rem;border-radius:12px;font-size:0.72rem;font-weight:600;">LOGIN</span>',
        logout: '<span style="background:#64748b20;color:#64748b;padding:0.2rem 0.6rem;border-radius:12px;font-size:0.72rem;font-weight:600;">LOGOUT</span>',
        migrated: '<span style="background:#f59e0b20;color:#f59e0b;padding:0.2rem 0.6rem;border-radius:12px;font-size:0.72rem;font-weight:600;">MIGRATED</span>'
    };
    return badges[action] || `<span style="background:#64748b20;color:#64748b;padding:0.2rem 0.6rem;border-radius:12px;font-size:0.72rem;font-weight:600;">${action.toUpperCase()}</span>`;
}

function getModuleIcon(module) {
    const icons = {
        receipt: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 1h8v14l-2-1.5L8 15l-2-1.5L4 15V1z" stroke="currentColor" stroke-width="1.2"/></svg>',
        client: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="3" stroke="currentColor" stroke-width="1.2"/><path d="M2 14c0-3 2.5-5 6-5s6 2 6 5" stroke="currentColor" stroke-width="1.2"/></svg>',
        petrol: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 14V5a1 1 0 011-1h5a1 1 0 011 1v9M3 14h7" stroke="currentColor" stroke-width="1.2"/><path d="M10 8l1.5-1.5L13 8v4a.5.5 0 01-.5.5H12" stroke="currentColor" stroke-width="1.2"/></svg>',
        user: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="2.5" stroke="currentColor" stroke-width="1.2"/><path d="M3 14c0-2.5 2-4.5 5-4.5s5 2 5 4.5" stroke="currentColor" stroke-width="1.2"/></svg>',
        tenant: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" stroke-width="1.2"/><path d="M5 7h6M5 10h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
        settings: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.2"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
        auth: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="4" y="7" width="8" height="6" rx="1" stroke="currentColor" stroke-width="1.2"/><path d="M6 7V5a2 2 0 014 0v2" stroke="currentColor" stroke-width="1.2"/></svg>',
        import: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 10v3h10v-3M8 2v7M5 7l3 3 3-3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    };
    return `<span style="color:var(--text-muted);display:flex;">${icons[module] || icons.settings}</span>`;
}

function formatDetails(details) {
    if (!details) return '';
    if (typeof details === 'string') return details;
    const parts = [];
    if (details.id) parts.push('ID: ' + details.id);
    if (details.amount) parts.push('RM ' + parseFloat(details.amount).toFixed(2));
    if (details.count) parts.push(details.count + ' records');
    return parts.join(' | ');
}

function clearAuditLog() {
    if (!confirm('Are you sure you want to clear the entire audit log? This cannot be undone.')) return;
    appData.auditLog = [];
    saveAppData(appData);
    loadAuditLog();
    showToast('Audit log cleared', 'info');
}

function exportAuditLog() {
    const logs = appData.auditLog || [];
    if (logs.length === 0) {
        showToast('No audit log entries to export', 'error');
        return;
    }

    let csv = 'Timestamp,Action,Module,Description,User,Tenant\n';
    logs.forEach(l => {
        csv += `"${l.timestamp}","${l.action}","${l.module}","${l.description.replace(/"/g, '""')}","${l.user}","${l.tenantCode}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'audit_log_' + new Date().toISOString().split('T')[0] + '.csv';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Audit log exported as CSV', 'success');
}
