/* ============================
   TRANSITPAY - Multi-Tenant System
   ============================ */

// ==================== TENANT REGISTRY ====================
const REGISTRY_KEY = 'transitpay_registry';

// Current session info
let currentSession = JSON.parse(sessionStorage.getItem('transitpay_session') || 'null');

function getRegistry() {
    const data = localStorage.getItem(REGISTRY_KEY);
    if (data) {
        const registry = JSON.parse(data);
        // Migrate old default phone number if still present
        const OLD_PHONE = '+60198765432';
        const NEW_PHONE = '+60123456789';
        let changed = false;
        if (registry.host && registry.host.phone === OLD_PHONE) {
            registry.host.phone = NEW_PHONE;
            registry.host.name = 'System Admin';
            changed = true;
        }
        const demo = registry.tenants ? registry.tenants.find(t => t.code === 'DEMO') : null;
        if (demo && demo.phone === OLD_PHONE) {
            demo.phone = NEW_PHONE;
            changed = true;
        }
        if (changed) {
            localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
        }
        return registry;
    }
    // First-time: pre-seed with host admin + a test tenant
    const initial = {
        host: {
            phone: '+60123456789',
            name: 'System Admin',
            createdAt: new Date().toISOString()
        },
        tenants: [
            {
                id: 'TN-' + Date.now(),
                code: 'DEMO',
                name: 'Demo Transport',
                phone: '+60123456789',
                status: 'Active',
                notes: 'Primary tenant account',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        ]
    };
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(initial));
    return initial;
}

function saveRegistry(registry) {
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
    if (typeof saveRegistryCloud === 'function') {
        saveRegistryCloud(registry);
    }
}

function saveSession(session) {
    currentSession = session;
    if (session) {
        sessionStorage.setItem('transitpay_session', JSON.stringify(session));
    } else {
        sessionStorage.removeItem('transitpay_session');
    }
}

// ==================== TENANT DATA ISOLATION ====================
// Each tenant's data is stored under a unique key: transitpay_<CODE>
function getTenantStorageKey(tenantCode) {
    if (!tenantCode || tenantCode === 'HOST') return 'transitpay_data';
    // Use consistent sanitization: uppercase and allow only letters/numbers/dashes/underscores
    const sanitized = tenantCode.toUpperCase().replace(/[^A-Z0-9_-]/g, '_');
    return 'transitpay_' + sanitized;
}

// Override the global STORAGE_KEY based on who is logged in
function activateTenantScope(tenantCode) {
    const key = getTenantStorageKey(tenantCode);
    // Update the global STORAGE_KEY used by app.js
    window._ACTIVE_STORAGE_KEY = key;
    window._ACTIVE_TENANT_CODE = tenantCode || 'HOST';
    // Reload app data from the correct scope
    appData = getAppData();
}

// ==================== LOGIN MODE SWITCHER ====================
function switchLoginMode(mode) {
    document.getElementById('loginMode').value = mode;
    document.getElementById('tabHost').classList.toggle('active', mode === 'host');
    document.getElementById('tabTenant').classList.toggle('active', mode === 'tenant');
    document.getElementById('tenantCodeGroup').style.display = mode === 'tenant' ? 'block' : 'none';

    // Focus appropriate field
    if (mode === 'tenant') {
        document.getElementById('tenantCodeInput').focus();
    } else {
        document.getElementById('phoneInput').focus();
    }
}

// ==================== HOST LOGIN ====================
async function handleHostLogin(phone) {
    const registry = getRegistry();
    const normalizedPhone = '+' + phone.replace(/^\+/, '');

    if (registry.host) {
        // Host exists — validate phone
        const hostPhone = '+' + registry.host.phone.replace(/^\+/, '');
        if (hostPhone !== normalizedPhone) {
            showToast('Host phone number does not match.', 'error');
            return false;
        }
    } else {
        // First-time setup — register this phone as host
        registry.host = {
            phone: normalizedPhone,
            name: 'System Admin',
            createdAt: new Date().toISOString()
        };
        saveRegistry(registry);
        showToast('Host account created! You are the platform administrator.', 'success');
    }

    // Create session
    const session = {
        type: 'host',
        tenantCode: 'HOST',
        phone: normalizedPhone,
        name: registry.host.name,
        role: 'Host Admin',
        loginTime: new Date().toISOString()
    };
    saveSession(session);

    // Set app data scope to host
    activateTenantScope('HOST');

    // FETCH FROM CLOUD BEFORE FIRST SAVE
    if (typeof getAppDataCloud === 'function') {
        const cloudData = await getAppDataCloud();
        if (cloudData) appData = cloudData;
    }

    // Set user in app data
    appData.user = {
        phone: normalizedPhone,
        name: registry.host.name,
        role: 'Host Admin',
        loginTime: session.loginTime
    };
    saveAppData(appData);

    return true;
}


// ==================== TENANT LOGIN ====================
async function handleTenantLogin(tenantCode, phone) {
    const registry = getRegistry();
    const normalizedPhone = '+' + phone.replace(/^\+/, '');
    const code = tenantCode.toUpperCase().trim();

    // Find tenant
    const tenant = registry.tenants.find(t => t.code === code);
    if (!tenant) {
        showToast('Invalid tenant code. Please check and try again.', 'error');
        return false;
    }

    // Check status
    if (tenant.status !== 'Active') {
        showToast('This tenant account is suspended. Contact administrator.', 'error');
        return false;
    }

    // Validate phone
    const tenantPhone = '+' + tenant.phone.replace(/^\+/, '');
    if (tenantPhone !== normalizedPhone) {
        showToast('Phone number does not match this tenant account.', 'error');
        return false;
    }

    // Create session
    const session = {
        type: 'tenant',
        tenantCode: code,
        tenantId: tenant.id,
        tenantName: tenant.name,
        phone: normalizedPhone,
        name: tenant.name,
        role: 'Tenant',
        loginTime: new Date().toISOString()
    };
    saveSession(session);

    // Set app data scope to this tenant
    activateTenantScope(code);

    // FETCH FROM CLOUD BEFORE FIRST SAVE
    if (typeof getAppDataCloud === 'function') {
        const cloudData = await getAppDataCloud();
        if (cloudData) appData = cloudData;
    }

    // Ensure tenant data structure exists
    if (!appData.user) {
        appData = getAppData(); // Re-init fresh data for new tenant
    }

    appData.user = {
        phone: normalizedPhone,
        name: tenant.name,
        role: 'Tenant',
        tenantCode: code,
        loginTime: session.loginTime
    };
    saveAppData(appData);

    return true;
}


// ==================== LOGIN AS TENANT (from Host) ====================
function loginAsTenant(tenantCode) {
    const registry = getRegistry();
    const tenant = registry.tenants.find(t => t.code === tenantCode);
    if (!tenant) {
        showToast('Tenant not found', 'error');
        return;
    }

    const session = {
        type: 'host-as-tenant',
        tenantCode: tenantCode,
        tenantId: tenant.id,
        tenantName: tenant.name,
        phone: tenant.phone,
        name: tenant.name + ' (Host View)',
        role: 'Host (Viewing Tenant)',
        originalSession: currentSession,
        loginTime: new Date().toISOString()
    };
    saveSession(session);

    // Switch to tenant's data scope
    activateTenantScope(tenantCode);

    appData.user = {
        phone: tenant.phone,
        name: session.name,
        role: session.role,
        tenantCode: tenantCode,
        loginTime: session.loginTime
    };
    saveAppData(appData);

    // Re-show app with tenant data
    showApp();
    showToast(`Viewing tenant: ${tenant.name} (${tenantCode})`, 'info');
}

// ==================== RETURN TO HOST ====================
function returnToHost() {
    if (currentSession && currentSession.originalSession) {
        saveSession(currentSession.originalSession);
    } else {
        // Fallback: re-login as host
        const registry = getRegistry();
        if (registry.host) {
            const session = {
                type: 'host',
                tenantCode: 'HOST',
                phone: registry.host.phone,
                name: registry.host.name,
                role: 'Host Admin',
                loginTime: new Date().toISOString()
            };
            saveSession(session);
        }
    }

    activateTenantScope('HOST');
    appData = getAppData();
    showApp();
    navigateTo('tenants');
    showToast('Returned to Host Dashboard', 'success');
}

// ==================== IS HOST? ====================
function isHost() {
    return currentSession && (currentSession.type === 'host');
}

function isHostViewingTenant() {
    return currentSession && currentSession.type === 'host-as-tenant';
}

function isTenant() {
    return currentSession && currentSession.type === 'tenant';
}

// ==================== UI VISIBILITY ====================
function updateMenuVisibility() {
    const hostOnlyItems = document.querySelectorAll('.host-only-menu');
    const tenantHiddenItems = document.querySelectorAll('#menuUsers, #menuDataImport');

    if (isHost()) {
        // Show all menus including tenant management
        hostOnlyItems.forEach(el => el.style.display = '');
        tenantHiddenItems.forEach(el => el.style.display = '');
    } else if (isHostViewingTenant()) {
        // Hide tenant management when viewing as tenant, but show "Return to Host" button
        hostOnlyItems.forEach(el => el.style.display = 'none');
        tenantHiddenItems.forEach(el => el.style.display = 'none');
    } else {
        // Regular tenant — hide host-only items + user management
        hostOnlyItems.forEach(el => el.style.display = 'none');
        tenantHiddenItems.forEach(el => el.style.display = 'none');
    }

    // Show/hide return to host banner
    updateReturnToHostBanner();
    // Show/hide tenant badge in sidebar
    updateTenantBadge();
}

function updateReturnToHostBanner() {
    let banner = document.getElementById('returnToHostBanner');
    if (isHostViewingTenant()) {
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'returnToHostBanner';
            banner.className = 'return-to-host-banner';
            banner.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M14 9H4M4 9L8 5M4 9L8 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span>Viewing as: <strong>${currentSession.tenantName} (${currentSession.tenantCode})</strong></span>
                <button class="btn btn-outline" onclick="returnToHost()" style="margin-left:auto;padding:0.35rem 0.75rem;font-size:0.75rem;">
                    Return to Host
                </button>
            `;
            const mainContent = document.querySelector('.main-content');
            if (mainContent) mainContent.prepend(banner);
        }
    } else {
        if (banner) banner.remove();
    }
}

function updateTenantBadge() {
    let badge = document.getElementById('tenantCodeBadge');
    if (currentSession && currentSession.tenantCode !== 'HOST') {
        if (!badge) {
            badge = document.createElement('div');
            badge.id = 'tenantCodeBadge';
            badge.className = 'tenant-code-badge';
            const sidebarHeader = document.querySelector('.sidebar-header');
            if (sidebarHeader) sidebarHeader.appendChild(badge);
        }
        badge.textContent = currentSession.tenantCode;
    } else {
        if (badge) badge.remove();
    }
}

// ==================== TENANT CRUD ====================
function saveTenant(e) {
    e.preventDefault();

    const code = document.getElementById('tenantCode').value.toUpperCase().trim();
    const name = document.getElementById('tenantName').value.trim();
    const phone = document.getElementById('tenantPhone').value.trim();
    const status = document.getElementById('tenantStatus').value;
    const notes = document.getElementById('tenantNotes').value.trim();
    const editingId = document.getElementById('editingTenantId').value;

    if (!code || !name || !phone) {
        showToast('Tenant code, name, and phone are required.', 'error');
        return false;
    }

    // Validate code format
    if (!/^[A-Z0-9\-]{3,12}$/.test(code)) {
        showToast('Tenant code must be 3-12 characters (letters, numbers, dashes).', 'error');
        return false;
    }

    const registry = getRegistry();

    if (editingId) {
        // Update existing
        const idx = registry.tenants.findIndex(t => t.id === editingId);
        if (idx !== -1) {
            // Check code uniqueness (excluding self)
            const codeDupe = registry.tenants.find(t => t.code === code && t.id !== editingId);
            if (codeDupe) {
                showToast('Tenant code already in use by another tenant.', 'error');
                return false;
            }

            const oldCode = registry.tenants[idx].code;
            registry.tenants[idx] = {
                ...registry.tenants[idx],
                code, name, phone: '+' + phone.replace(/^\+/, ''), status, notes,
                updatedAt: new Date().toISOString()
            };

            // If code changed, migrate data
            if (oldCode !== code) {
                const oldKey = getTenantStorageKey(oldCode);
                const newKey = getTenantStorageKey(code);
                const existingData = localStorage.getItem(oldKey);
                if (existingData) {
                    localStorage.setItem(newKey, existingData);
                    localStorage.removeItem(oldKey);
                }
            }

            showToast('Tenant updated successfully!', 'success');
        }
    } else {
        // Check for duplicate code
        const codeDupe = registry.tenants.find(t => t.code === code);
        if (codeDupe) {
            showToast('A tenant with this code already exists.', 'error');
            return false;
        }

        // Add new tenant
        const tenant = {
            id: 'TN-' + Date.now(),
            code,
            name,
            phone: '+' + phone.replace(/^\+/, ''),
            status,
            notes,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        registry.tenants.push(tenant);

        // Initialize empty data store for this tenant
        const tenantKey = getTenantStorageKey(code);
        if (!localStorage.getItem(tenantKey)) {
            localStorage.setItem(tenantKey, JSON.stringify({
                user: null,
                receipts: [],
                clients: [],
                users: [],
                petrolExpenses: [],
                locations: [
                    'Kuala Lumpur', 'Petaling Jaya', 'Shah Alam', 'Subang Jaya',
                    'Putra Heights', 'Cyberjaya', 'Klang', 'Ampang', 'Cheras',
                    'Kepong', 'Setapak', 'Wangsa Maju', 'Sri Hartamas',
                    'Mont Kiara', 'Bangsar', 'KLIA', 'KLIA2'
                ],
                carPlates: ['BEP 813'],
                emailHistory: [],
                nextReceiptNumber: 1001
            }));
        }

        showToast(`Tenant "${name}" created with code: ${code}`, 'success');
    }

    saveRegistry(registry);
    clearTenantForm();
    loadTenants();
    return false;
}

function clearTenantForm() {
    document.getElementById('tenantCode').value = '';
    document.getElementById('tenantName').value = '';
    document.getElementById('tenantPhone').value = '';
    document.getElementById('tenantStatus').value = 'Active';
    document.getElementById('tenantNotes').value = '';
    document.getElementById('editingTenantId').value = '';
    document.getElementById('tenantCode').removeAttribute('readonly');
    document.getElementById('tenantFormTitle').textContent = 'Add New Tenant';
    document.getElementById('saveTenantBtn').innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        Add Tenant
    `;
}

function editTenant(tenantId) {
    const registry = getRegistry();
    const tenant = registry.tenants.find(t => t.id === tenantId);
    if (!tenant) return;

    document.getElementById('tenantCode').value = tenant.code;
    document.getElementById('tenantName').value = tenant.name;
    document.getElementById('tenantPhone').value = tenant.phone.replace(/^\+/, '');
    document.getElementById('tenantStatus').value = tenant.status;
    document.getElementById('tenantNotes').value = tenant.notes || '';
    document.getElementById('editingTenantId').value = tenant.id;
    document.getElementById('tenantFormTitle').textContent = 'Edit Tenant';
    document.getElementById('saveTenantBtn').innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 13l1.5-5L12 1l3 3-7.5 7.5L3 13z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
        </svg>
        Update Tenant
    `;

    // Scroll to form
    document.querySelector('#tenantsSection .receipt-form-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function toggleTenantStatus(tenantId) {
    const registry = getRegistry();
    const tenant = registry.tenants.find(t => t.id === tenantId);
    if (!tenant) return;

    tenant.status = tenant.status === 'Active' ? 'Suspended' : 'Active';
    tenant.updatedAt = new Date().toISOString();
    saveRegistry(registry);
    loadTenants();
    showToast(`Tenant ${tenant.code} is now ${tenant.status}`, tenant.status === 'Active' ? 'success' : 'info');
}

function deleteTenant(tenantId) {
    const registry = getRegistry();
    const tenant = registry.tenants.find(t => t.id === tenantId);
    if (!tenant) return;

    if (!confirm(`Delete tenant "${tenant.name}" (${tenant.code})?\n\nThis will permanently remove all their data. This cannot be undone.`)) {
        return;
    }

    // Remove tenant data from localStorage
    const tenantKey = getTenantStorageKey(tenant.code);
    localStorage.removeItem(tenantKey);

    // Remove from registry
    registry.tenants = registry.tenants.filter(t => t.id !== tenantId);
    saveRegistry(registry);

    clearTenantForm();
    loadTenants();
    showToast(`Tenant "${tenant.name}" deleted.`, 'info');
}

// ==================== TENANT LIST RENDERING ====================
async function loadTenants() {
    const registry = getRegistry();
    const grid = document.getElementById('tenantCardsGrid');
    const countEl = document.getElementById('totalTenantsCount');

    if (!grid) return;

    const tenants = registry.tenants || [];
    countEl.textContent = tenants.length + ' Tenant' + (tenants.length !== 1 ? 's' : '');

    if (tenants.length === 0) {
        grid.innerHTML = `
            <div class="tenant-empty-state">
                <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                    <rect x="8" y="12" width="40" height="32" rx="4" stroke="var(--primary-500)" stroke-width="2" opacity="0.3"/>
                    <path d="M8 20h40" stroke="var(--primary-500)" stroke-width="2" opacity="0.3"/>
                    <path d="M20 32h16M20 38h10" stroke="var(--primary-400)" stroke-width="2" stroke-linecap="round"/>
                </svg>
                <h3>No tenants yet</h3>
                <p>Create your first tenant using the form above. Each tenant will get their own isolated dashboard and data.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = tenants.map(tenant => {
        const isActive = tenant.status === 'Active';
        const statusBadge = isActive
            ? '<span class="badge badge-active">Active</span>'
            : '<span class="badge badge-inactive">Suspended</span>';

        // Get tenant data stats
        const tenantKey = getTenantStorageKey(tenant.code);
        const tenantRaw = localStorage.getItem(tenantKey);
        let tenantData = {};
        let statsLoading = false;

        if (tenantRaw) {
            tenantData = JSON.parse(tenantRaw);
        } else if (typeof fsGetAppData === 'function') {
            // Stats aren't local - we'll need to fetch them
            statsLoading = true;
            // Trigger background fetch
            fsGetAppData(tenant.code).then(data => {
                if (data) {
                    localStorage.setItem(tenantKey, JSON.stringify(data));
                    // Re-render only if still on the tenants page
                    if (document.getElementById('tenantsSection').classList.contains('active')) {
                        loadTenants();
                    }
                }
            });
        }

        const receiptsCount = (tenantData.receipts || []).length;
        const clientsCount = (tenantData.clients || []).length;
        const totalEarnings = (tenantData.receipts || []).reduce((s, r) => s + (r.total || 0), 0);

        return `
            <div class="tenant-card ${isActive ? '' : 'suspended'}">
                <div class="tenant-card-header">
                    <div class="tenant-code-chip">${tenant.code}</div>
                    ${statusBadge}
                </div>
                <div class="tenant-card-body">
                    <h3 class="tenant-card-name">${tenant.name}</h3>
                    <p class="tenant-card-phone">${tenant.phone}</p>
                    ${tenant.notes ? `<p class="tenant-card-notes">${tenant.notes}</p>` : ''}
                </div>
                <div class="tenant-card-stats ${statsLoading ? 'loading-stats' : ''}">
                    ${statsLoading ? `
                        <div style="grid-column:1/-1;text-align:center;padding:0.5rem;font-size:0.75rem;color:var(--text-muted);">
                            Fetching cloud stats...
                        </div>
                    ` : `
                        <div class="tenant-stat">
                            <span class="tenant-stat-value">${receiptsCount}</span>
                            <span class="tenant-stat-label">Receipts</span>
                        </div>
                        <div class="tenant-stat">
                            <span class="tenant-stat-value">${clientsCount}</span>
                            <span class="tenant-stat-label">Clients</span>
                        </div>
                        <div class="tenant-stat">
                            <span class="tenant-stat-value">RM ${totalEarnings.toFixed(0)}</span>
                            <span class="tenant-stat-label">Earnings</span>
                        </div>
                    `}
                </div>
                <div class="tenant-card-footer">
                    <button class="btn btn-outline" onclick="copyTenantLink('${tenant.code}')" title="Copy tenant portal link" style="font-size:0.75rem;padding:0.35rem 0.7rem;">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <rect x="4" y="4" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.2"/>
                            <path d="M4 10H3a1.5 1.5 0 01-1.5-1.5v-6A1.5 1.5 0 013 1h6A1.5 1.5 0 0110.5 2.5V4" stroke="currentColor" stroke-width="1.2"/>
                        </svg>
                        Link
                    </button>
                    <button class="btn btn-outline" onclick="loginAsTenant('${tenant.code}')" title="View tenant dashboard" style="font-size:0.75rem;padding:0.35rem 0.7rem;">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M2 7C2 7 4 3 7 3C10 3 12 7 12 7C12 7 10 11 7 11C4 11 2 7 2 7Z" stroke="currentColor" stroke-width="1.2"/>
                            <circle cx="7" cy="7" r="2" stroke="currentColor" stroke-width="1.2"/>
                        </svg>
                        View
                    </button>
                    <button class="btn-action" onclick="editTenant('${tenant.id}')" title="Edit tenant">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M2.5 11.5L4 6L10 0l3 3-6 6L2.5 11.5z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
                        </svg>
                    </button>
                    <button class="btn-action" onclick="toggleTenantStatus('${tenant.id}')" title="${isActive ? 'Suspend' : 'Activate'}">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            ${isActive
                ? '<path d="M5 3v8M9 3v8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'
                : '<polygon points="3,1 3,13 12,7" stroke="currentColor" stroke-width="1.2" fill="none"/>'}
                        </svg>
                    </button>
                    <button class="btn-action btn-action-danger" onclick="deleteTenant('${tenant.id}')" title="Delete tenant">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M2 4h10M5 4V2.5h4V4M3.5 4v8h7V4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                </div>
                <div class="tenant-card-meta">
                    Created: ${formatDate(tenant.createdAt)}
                </div>
            </div>
        `;
    }).join('');
}


// ==================== COPY TENANT PORTAL LINK ====================
function copyTenantLink(tenantCode) {
    const baseUrl = window.location.href.replace(/\/[^\/]*$/, '/');
    const tenantUrl = baseUrl + 'portal.html?code=' + tenantCode;
    navigator.clipboard.writeText(tenantUrl).then(() => {
        showToast(`Portal link copied for ${tenantCode}! Share this with your client.`, 'success');
    }).catch(() => {
        // Fallback
        const input = document.createElement('input');
        input.value = tenantUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        showToast(`Portal link copied for ${tenantCode}!`, 'success');
    });
}
