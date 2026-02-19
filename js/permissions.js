/* ============================
   TRANSITPAY - Permissions Engine
   Defines what each role can do and enforces it across the app.
   ============================ */

// ==================== ROLE DEFINITIONS ====================
// These are the default permissions for each role.
// Admins can customise Operator & Viewer permissions.

const DEFAULT_PERMISSIONS = {
    Admin: {
        label: 'Admin',
        color: '#6366f1',
        description: 'Full access to everything. Can manage users and permissions.',
        locked: true, // Admin perms can never be changed
        permissions: {
            dashboard: { view: true, create: true, edit: true, delete: true },
            receipts: { view: true, create: true, edit: true, delete: true },
            clients: { view: true, create: true, edit: true, delete: true },
            trips: { view: true, create: true, edit: true, delete: true },
            petrol: { view: true, create: true, edit: true, delete: true },
            reports: { view: true, create: true, edit: true, delete: true },
            email: { view: true, create: true, edit: true, delete: true },
            users: { view: true, create: true, edit: true, delete: true },
            settings: { view: true, create: true, edit: true, delete: true },
            dataImport: { view: true, create: true, edit: true, delete: true },
            tenants: { view: true, create: true, edit: true, delete: true },
            permissions: { view: true, create: true, edit: true, delete: true },
        }
    },
    Operator: {
        label: 'Operator',
        color: '#10b981',
        description: 'Can add and edit records, but cannot delete or change settings.',
        locked: false,
        permissions: {
            dashboard: { view: true, create: false, edit: false, delete: false },
            receipts: { view: true, create: true, edit: true, delete: false },
            clients: { view: true, create: true, edit: true, delete: false },
            trips: { view: true, create: true, edit: true, delete: false },
            petrol: { view: true, create: true, edit: true, delete: false },
            reports: { view: true, create: false, edit: false, delete: false },
            email: { view: true, create: true, edit: false, delete: false },
            users: { view: false, create: false, edit: false, delete: false },
            settings: { view: false, create: false, edit: false, delete: false },
            dataImport: { view: false, create: false, edit: false, delete: false },
            tenants: { view: false, create: false, edit: false, delete: false },
            permissions: { view: false, create: false, edit: false, delete: false },
        }
    },
    Viewer: {
        label: 'Viewer',
        color: '#f59e0b',
        description: 'Read-only access. Cannot create, edit, or delete anything.',
        locked: false,
        permissions: {
            dashboard: { view: true, create: false, edit: false, delete: false },
            receipts: { view: true, create: false, edit: false, delete: false },
            clients: { view: true, create: false, edit: false, delete: false },
            trips: { view: true, create: false, edit: false, delete: false },
            petrol: { view: true, create: false, edit: false, delete: false },
            reports: { view: true, create: false, edit: false, delete: false },
            email: { view: false, create: false, edit: false, delete: false },
            users: { view: false, create: false, edit: false, delete: false },
            settings: { view: false, create: false, edit: false, delete: false },
            dataImport: { view: false, create: false, edit: false, delete: false },
            tenants: { view: false, create: false, edit: false, delete: false },
            permissions: { view: false, create: false, edit: false, delete: false },
        }
    },
    Tenant: {
        label: 'Tenant',
        color: '#8b5cf6',
        description: 'Client portal access. Can view their own data including clients.',
        locked: true,
        permissions: {
            dashboard: { view: true, create: false, edit: false, delete: false },
            receipts: { view: true, create: true, edit: false, delete: false },
            clients: { view: true, create: true, edit: true, delete: false },
            trips: { view: true, create: false, edit: false, delete: false },
            petrol: { view: false, create: false, edit: false, delete: false },
            reports: { view: true, create: false, edit: false, delete: false },
            email: { view: false, create: false, edit: false, delete: false },
            users: { view: false, create: false, edit: false, delete: false },
            settings: { view: false, create: false, edit: false, delete: false },
            dataImport: { view: false, create: false, edit: false, delete: false },
            tenants: { view: false, create: false, edit: false, delete: false },
            permissions: { view: false, create: false, edit: false, delete: false },
        }
    }
};

// Human-readable labels for modules and actions
const MODULE_LABELS = {
    dashboard: { label: 'Dashboard', icon: '📊' },
    receipts: { label: 'Receipts', icon: '🧾' },
    clients: { label: 'Clients', icon: '👥' },
    trips: { label: 'Trips', icon: '🚗' },
    petrol: { label: 'Petrol', icon: '⛽' },
    reports: { label: 'Reports', icon: '📈' },
    email: { label: 'Email Invoice', icon: '📧' },
    users: { label: 'User Accounts', icon: '👤' },
    settings: { label: 'Settings', icon: '⚙️' },
    dataImport: { label: 'Data Import', icon: '📂' },
    tenants: { label: 'Tenant Mgmt', icon: '🏢' },
    permissions: { label: 'Permissions', icon: '🔑' },
};

// ==================== GET ACTIVE PERMISSIONS ====================
function getPermissions() {
    // Load customised permissions from appData, fall back to defaults
    const saved = (appData && appData.rolePermissions) ? appData.rolePermissions : {};
    const merged = {};
    for (const role of Object.keys(DEFAULT_PERMISSIONS)) {
        merged[role] = {
            ...DEFAULT_PERMISSIONS[role],
            permissions: {
                ...DEFAULT_PERMISSIONS[role].permissions,
                ...(saved[role] ? saved[role].permissions : {})
            }
        };
        // Admin & Tenant are always locked to defaults
        if (DEFAULT_PERMISSIONS[role].locked) {
            merged[role].permissions = { ...DEFAULT_PERMISSIONS[role].permissions };
        }
    }
    return merged;
}

// ==================== CHECK A PERMISSION ====================
function can(action, module) {
    const userRole = (appData && appData.user && appData.user.role) ? appData.user.role : 'Viewer';
    // Host Admin always has all permissions
    if (userRole === 'Host Admin') return true;
    const perms = getPermissions();
    const rolePerms = perms[userRole];
    if (!rolePerms) return false;
    const modulePerms = rolePerms.permissions[module];
    if (!modulePerms) return false;
    return !!modulePerms[action];
}

// ==================== SAVE PERMISSIONS ====================
function savePermissions(rolePermissions) {
    if (!appData.rolePermissions) appData.rolePermissions = {};
    // Only save non-locked roles
    for (const role of Object.keys(rolePermissions)) {
        if (!DEFAULT_PERMISSIONS[role].locked) {
            appData.rolePermissions[role] = { permissions: rolePermissions[role].permissions };
        }
    }
    saveAppData(appData);
    showToast('Permissions saved!', 'success');
    applyPermissions();
}

// ==================== APPLY PERMISSIONS TO UI ====================
// Call this after login and after saving permissions
function applyPermissions() {
    const userRole = (appData && appData.user && appData.user.role) ? appData.user.role : 'Viewer';
    const isHostAdmin = userRole === 'Host Admin';
    const isAdmin = userRole === 'Admin';
    const canManage = isHostAdmin || isAdmin;

    // Sidebar menu items — map page names to module keys
    const menuMap = {
        dashboard: 'dashboard',
        clients: 'clients',
        newReceipt: 'receipts',
        trips: 'trips',
        receipts: 'receipts',
        reports: 'reports',
        petrol: 'petrol',
        email: 'email',
        users: 'users',
        settings: 'settings',
        dataImport: 'dataImport',
        tenants: 'tenants',
        permissions: 'permissions',
    };

    document.querySelectorAll('.sidebar-menu .menu-item[data-page]').forEach(item => {
        const page = item.getAttribute('data-page');
        const module = menuMap[page];
        if (!module) return;
        const allowed = isHostAdmin || can('view', module);
        item.style.display = allowed ? '' : 'none';
    });

    // Show/hide host-only items
    document.querySelectorAll('.host-only-menu').forEach(el => {
        el.style.display = isHostAdmin ? '' : 'none';
    });

    // Action buttons (create / delete inside sections)
    applyActionPermissions();

    // Update role badge in sidebar
    const roleEl = document.querySelector('.user-role');
    if (roleEl) {
        roleEl.textContent = userRole;
        roleEl.style.color = getRoleColor(userRole);
    }
}

function getRoleColor(role) {
    const colors = {
        'Admin': '#6366f1',
        'Operator': '#10b981',
        'Viewer': '#f59e0b',
        'Tenant': '#8b5cf6',
        'Host Admin': '#6366f1',
    };
    return colors[role] || 'var(--text-muted)';
}

function applyActionPermissions() {
    const userRole = (appData && appData.user && appData.user.role) ? appData.user.role : 'Viewer';
    const isHostAdmin = userRole === 'Host Admin';

    // Buttons tagged with data-perm-module and data-perm-action
    document.querySelectorAll('[data-perm-module][data-perm-action]').forEach(el => {
        const module = el.getAttribute('data-perm-module');
        const action = el.getAttribute('data-perm-action');
        const allowed = isHostAdmin || can(action, module);
        el.style.display = allowed ? '' : 'none';
        el.disabled = !allowed;
    });
}

// ==================== PERMISSIONS PAGE ====================
function loadPermissionsPage() {
    const perms = getPermissions();
    const userRole = (appData && appData.user && appData.user.role) || 'Viewer';
    const canEdit = userRole === 'Host Admin' || userRole === 'Admin';

    // Render role summary cards
    const summaryEl = document.getElementById('permRoleSummary');
    if (summaryEl) {
        summaryEl.innerHTML = Object.entries(perms).map(([role, cfg]) => `
            <div class="perm-role-card" style="border-left: 3px solid ${cfg.color};">
                <div class="perm-role-header">
                    <span class="perm-role-badge" style="background:${cfg.color}20;color:${cfg.color};">${cfg.label}</span>
                    ${cfg.locked ? '<span class="perm-locked-tag">🔒 Locked</span>' : ''}
                </div>
                <p class="perm-role-desc">${cfg.description}</p>
                <div class="perm-role-stats">
                    <span>${Object.values(cfg.permissions).filter(p => p.view).length} modules visible</span>
                    <span>${Object.values(cfg.permissions).filter(p => p.create || p.edit || p.delete).length} editable</span>
                </div>
            </div>
        `).join('');
    }

    // Render permission matrix
    const matrixEl = document.getElementById('permMatrix');
    if (!matrixEl) return;

    const editableRoles = Object.entries(perms).filter(([r, cfg]) => !cfg.locked);
    const roleOrder = Object.keys(perms);

    matrixEl.innerHTML = `
        <div class="perm-matrix-wrapper">
            <table class="perm-table">
                <thead>
                    <tr>
                        <th class="perm-module-col">Module</th>
                        ${roleOrder.map(role => `
                            <th class="perm-role-col" style="border-top: 3px solid ${perms[role].color};">
                                <span style="color:${perms[role].color};">${perms[role].label}</span>
                                ${perms[role].locked ? '<br><small style="color:var(--text-muted);font-weight:400;">🔒 Fixed</small>' : ''}
                            </th>
                        `).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(MODULE_LABELS).map(([module, info]) => `
                        <tr>
                            <td class="perm-module-cell">
                                <span class="perm-module-icon">${info.icon}</span>
                                <span class="perm-module-name">${info.label}</span>
                            </td>
                            ${roleOrder.map(role => {
        const mperms = perms[role].permissions[module] || {};
        const locked = perms[role].locked || !canEdit;
        return `
                                <td class="perm-actions-cell">
                                    <div class="perm-toggles">
                                        ${['view', 'create', 'edit', 'delete'].map(action => {
            const checked = !!mperms[action];
            const id = `perm_${role}_${module}_${action}`;
            return `
                                            <label class="perm-toggle-label ${locked ? 'perm-locked' : ''}" title="${action}">
                                                <input type="checkbox" id="${id}"
                                                    data-role="${role}" data-module="${module}" data-action="${action}"
                                                    ${checked ? 'checked' : ''}
                                                    ${locked ? 'disabled' : ''}
                                                    onchange="onPermToggle(this)"
                                                >
                                                <span class="perm-toggle-text">${action[0].toUpperCase()}</span>
                                            </label>`;
        }).join('')}
                                    </div>
                                </td>`;
    }).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ${canEdit ? `
        <div class="perm-save-bar">
            <div class="perm-legend">
                <span class="perm-legend-item"><strong>V</strong> = View</span>
                <span class="perm-legend-item"><strong>C</strong> = Create</span>
                <span class="perm-legend-item"><strong>E</strong> = Edit</span>
                <span class="perm-legend-item"><strong>D</strong> = Delete</span>
            </div>
            <button class="btn btn-primary" onclick="savePermissionsFromUI()">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8l4 4 6-8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Save Permissions
            </button>
        </div>
        ` : `<div class="perm-readonly-notice">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 1L2 4v4c0 3.5 2.5 6.5 6 7.5 3.5-1 6-4 6-7.5V4L8 1z" stroke="currentColor" stroke-width="1.2" fill="none"/>
            </svg>
            Permissions can only be changed by an Admin or Host Admin.
        </div>`}
    `;
}

function onPermToggle(checkbox) {
    // If "view" is unchecked, uncheck all others
    const action = checkbox.getAttribute('data-action');
    const role = checkbox.getAttribute('data-role');
    const module = checkbox.getAttribute('data-module');

    if (action === 'view' && !checkbox.checked) {
        ['create', 'edit', 'delete'].forEach(a => {
            const el = document.getElementById(`perm_${role}_${module}_${a}`);
            if (el) el.checked = false;
        });
    }
    // If create/edit/delete is checked, auto-enable view
    if (['create', 'edit', 'delete'].includes(action) && checkbox.checked) {
        const viewEl = document.getElementById(`perm_${role}_${module}_view`);
        if (viewEl) viewEl.checked = true;
    }
}

function savePermissionsFromUI() {
    const perms = getPermissions();
    const editableRoles = Object.keys(DEFAULT_PERMISSIONS).filter(r => !DEFAULT_PERMISSIONS[r].locked);

    for (const role of editableRoles) {
        for (const module of Object.keys(MODULE_LABELS)) {
            for (const action of ['view', 'create', 'edit', 'delete']) {
                const el = document.getElementById(`perm_${role}_${module}_${action}`);
                if (el) {
                    perms[role].permissions[module][action] = el.checked;
                }
            }
        }
    }

    savePermissions(perms);
    loadPermissionsPage(); // re-render
}

// ==================== USERS SECTION (integrated) ====================
function loadUsersSection() {
    loadUsers();
    updateUserPermSummary();
}

function updateUserPermSummary() {
    const el = document.getElementById('userPermSummaryList');
    if (!el) return;
    const users = (appData && appData.users) || [];
    const counts = { Admin: 0, Operator: 0, Viewer: 0 };
    users.forEach(u => { if (counts[u.role] !== undefined) counts[u.role]++; });
    el.innerHTML = Object.entries(counts).map(([role, count]) => `
        <div class="user-perm-count">
            <span class="perm-role-badge" style="background:${DEFAULT_PERMISSIONS[role]?.color || '#6b7280'}20;color:${DEFAULT_PERMISSIONS[role]?.color || '#6b7280'};">
                ${role}
            </span>
            <span style="font-weight:600;">${count}</span>
            <span style="color:var(--text-muted);font-size:0.8rem;">user${count !== 1 ? 's' : ''}</span>
        </div>
    `).join('');
}

console.log('[TransitPay] permissions.js loaded ✅');
