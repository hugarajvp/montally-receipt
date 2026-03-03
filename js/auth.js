/* ============================
   TRANSITPAY - Portal Authentication Logic
   Separated from portal.html for better maintainability.
   ============================ */

const PORTAL_REGISTRY_KEY = 'transitpay_registry';

// =========================================================
// HARDCODED TENANT FALLBACK
// These are injected immediately so login works on ANY
// browser even when Firestore cloud sync is slow/failing.
// =========================================================
const KNOWN_TENANTS = [
    { code: 'HUGA', name: 'Huga Services', phone: '+60178850938', status: 'Active', createdAt: '2026-02-19T00:00:00.000Z' },
    { code: 'VIONA', name: 'VIONA', phone: '+60165858672', status: 'Active', createdAt: '2026-02-25T00:00:00.000Z' },
    { code: 'JUDY', name: 'Judy transport', phone: '+60169071675', status: 'Active', createdAt: '2026-02-25T00:00:00.000Z' }
];

/**
 * Merges KNOWN_TENANTS into the local registry so login
 * works immediately without waiting for cloud sync.
 */
function injectKnownTenants() {
    try {
        const raw = localStorage.getItem(PORTAL_REGISTRY_KEY);
        let registry = raw ? JSON.parse(raw) : { host: {}, tenants: [] };
        if (!registry.tenants) registry.tenants = [];

        let changed = false;

        // Inject known host if missing or still at default placeholder
        const DEFAULT_PHONE = '+60123456789';
        const hostPhone = registry.host && registry.host.phone;
        if (!hostPhone || hostPhone === DEFAULT_PHONE) {
            registry.host = { name: 'VIONA', phone: '0165858672', createdAt: '2026-02-25T20:38:00.000Z' };
            changed = true;
            console.log('[Portal] Injected fallback host data');
        }

        // Inject known tenants if missing
        for (const kt of KNOWN_TENANTS) {
            const exists = registry.tenants.find(t => (t.code || '').toUpperCase() === kt.code);
            if (!exists) {
                registry.tenants.push(kt);
                changed = true;
                console.log('[Portal] Injected fallback tenant:', kt.code);
            }
        }
        if (changed) {
            localStorage.setItem(PORTAL_REGISTRY_KEY, JSON.stringify(registry));
            console.log('[Portal] Fallback data saved to localStorage ✅');
        }
    } catch (e) {
        console.warn('[Portal] Could not inject known tenants:', e.message);
    }
}

/**
 * Ensures a DEMO tenant exists in the registry for testing/first-run.
 * IMPORTANT: Only seeds default data when NO registry exists at all (local or cloud).
 * This prevents overwriting cloud-synced data on new devices.
 */
function ensureDemoTenant() {
    const data = localStorage.getItem(PORTAL_REGISTRY_KEY);
    let registry;
    if (data) {
        try {
            registry = JSON.parse(data);
        } catch (e) {
            console.error('[Portal] Failed to parse registry data:', e);
            registry = null;
        }
    }

    // If we already have a registry with a real host (not default), don't touch it
    // This prevents overwriting cloud-synced host data on new PCs
    const DEFAULT_PHONE = '+60123456789';
    const OLD_PHONE = '+60198765432';
    if (registry && registry.host && registry.host.phone
        && registry.host.phone !== DEFAULT_PHONE
        && registry.host.phone !== OLD_PHONE) {
        console.log('[Portal] Registry exists with real host data, skipping seed.');
        if (!registry.tenants) registry.tenants = [];
        return registry;
    }

    if (!registry) {
        registry = {
            host: {
                phone: DEFAULT_PHONE,
                name: 'System Admin',
                createdAt: new Date().toISOString()
            },
            tenants: []
        };
    }

    // Ensure tenants array exists
    if (!registry.tenants) registry.tenants = [];

    // Migrate old default phone number if still present
    if (registry.host && registry.host.phone === OLD_PHONE) {
        registry.host.phone = DEFAULT_PHONE;
        registry.host.name = 'System Admin';
    }

    const demoTenant = registry.tenants.find(t => t.code === 'DEMO');
    if (!demoTenant) {
        registry.tenants.push({
            id: 'TN-' + Date.now(),
            code: 'DEMO',
            name: 'Demo Transport',
            phone: DEFAULT_PHONE,
            status: 'Active',
            notes: 'Primary tenant account',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
    } else if (demoTenant.phone === OLD_PHONE) {
        demoTenant.phone = DEFAULT_PHONE;
    }

    if (!registry.host) {
        registry.host = {
            phone: DEFAULT_PHONE,
            name: 'System Admin',
            createdAt: new Date().toISOString()
        };
    }
    localStorage.setItem(PORTAL_REGISTRY_KEY, JSON.stringify(registry));
    return registry;
}

/**
 * Switches between Tenant and Host login tabs.
 */
function switchTab(tab) {
    const tenantTab = document.getElementById('tabTenant');
    const hostTab = document.getElementById('tabHost');
    const tenantPanel = document.getElementById('tenantPanel');
    const hostPanel = document.getElementById('hostPanel');
    const subtitle = document.getElementById('portalSubtitle');
    const errorMsg = document.getElementById('errorMsg');
    const successMsg = document.getElementById('successMsg');

    if (errorMsg) errorMsg.classList.remove('visible');
    if (successMsg) successMsg.classList.remove('visible');

    if (tab === 'tenant') {
        if (tenantTab) tenantTab.classList.add('active');
        if (hostTab) hostTab.classList.remove('active');
        if (tenantPanel) tenantPanel.classList.add('active');
        if (hostPanel) hostPanel.classList.remove('active');
        if (subtitle) subtitle.textContent = 'Tenant Portal Access';
    } else {
        if (hostTab) hostTab.classList.add('active');
        if (tenantTab) tenantTab.classList.remove('active');
        if (hostPanel) hostPanel.classList.add('active');
        if (tenantPanel) tenantPanel.classList.remove('active');
        if (subtitle) subtitle.textContent = 'System Admin';
    }
}

/**
 * Displays an error message on the portal login screen.
 */
function showPortalError(message) {
    const errorMsg = document.getElementById('errorMsg');
    const errorText = document.getElementById('errorText');
    if (errorText) errorText.textContent = message;
    if (errorMsg) {
        errorMsg.classList.add('visible');
        setTimeout(() => { errorMsg.classList.remove('visible'); }, 5000);
    }
}

/**
 * Loads saved host credentials from localStorage to pre-fill the form.
 */
function loadSavedHostCredentials() {
    const saved = localStorage.getItem('transitpay_host_credentials');
    if (saved) {
        try {
            const creds = JSON.parse(saved);
            if (creds.username) {
                const el = document.getElementById('hostUsername');
                if (el) el.value = creds.username;
            }
            if (creds.name) {
                const el = document.getElementById('hostName');
                if (el) el.value = creds.name;
            }
            if (creds.hostname) {
                const el = document.getElementById('hostHostname');
                if (el) el.value = creds.hostname;
            }
            if (creds.phone) {
                const el = document.getElementById('hostPhone');
                if (el) el.value = creds.phone.replace(/^\+/, '');
            }
        } catch (e) { }
    }
}

/**
 * Handles the Tenant login process.
 */
async function handlePortalLogin(e) {
    if (e) e.preventDefault();
    const loginBtn = document.getElementById('tenantLoginBtn');
    const errorMsg = document.getElementById('errorMsg');
    const successMsg = document.getElementById('successMsg');

    if (errorMsg) errorMsg.classList.remove('visible');
    if (successMsg) successMsg.classList.remove('visible');

    const tenantCodeInput = document.getElementById('tenantCodeInput');
    const phoneInput = document.getElementById('phoneInput');

    const tenantCode = tenantCodeInput ? tenantCodeInput.value.trim().toUpperCase() : '';
    const phone = phoneInput ? phoneInput.value.trim() : '';

    if (!tenantCode) { showPortalError('Please enter your tenant code.'); return false; }
    if (!phone || phone.length < 6) { showPortalError('Please enter a valid phone number.'); return false; }

    if (loginBtn) loginBtn.classList.add('loading');

    try {
        // Wait for registry to sync from cloud
        if (typeof waitForRegistrySync === 'function') {
            console.log(`[Portal] Requesting registry sync for ${tenantCode}...`);
            await waitForRegistrySync(8000, tenantCode);
        }

        const registry = getRegistry();
        const normalizedPhone = normalizePhone(phone);
        const searchCode = tenantCode.toUpperCase();
        let tenant = registry.tenants ? registry.tenants.find(t => (t.code || '').toUpperCase() === searchCode) : null;

        // DISCOVERY MODE: If registry sync failed or tenant is missing, try a direct document fetch
        if (!tenant && window.firebaseReady) {
            console.log(`[Portal] Tenant "${searchCode}" not in registry. Trying Direct Discovery...`);

            // Wait a moment for auth to stabilize
            await new Promise(r => setTimeout(r, 1000));

            try {
                // Method 1: Directly check if tenant document exists in Firestore
                if (typeof db !== 'undefined' && db) {
                    console.log(`[Portal] Checking Firestore tenants/${searchCode}...`);
                    const tenantSnap = await Promise.race([
                        db.collection('tenants').doc(searchCode).get(),
                        new Promise((_, rej) => setTimeout(() => rej(new Error('Discovery timeout')), 8000))
                    ]);
                    if (tenantSnap.exists) {
                        const tenantData = tenantSnap.data();
                        tenant = {
                            id: 'TN-' + Date.now(),
                            code: searchCode,
                            name: tenantData.tenantName || searchCode,
                            phone: tenantData.phone || '',
                            status: 'Active',
                            isDiscovered: true
                        };
                        console.log('[Portal] Tenant discovered via direct Firestore lookup ✅');
                    }
                }

                // Method 2: Fallback - try via getAppDataCloud
                if (!tenant) {
                    activateTenantScope(searchCode);
                    if (typeof getAppDataCloud === 'function') {
                        const cloudData = await getAppDataCloud();
                        if (cloudData) {
                            tenant = {
                                id: (cloudData.user && cloudData.user.tenantId) || ('TN-' + Date.now()),
                                code: searchCode,
                                name: (cloudData.user && cloudData.user.tenantName) || cloudData.tenantName || searchCode,
                                phone: (cloudData.user && cloudData.user.phone) || '',
                                status: 'Active',
                                isDiscovered: true
                            };
                            console.log('[Portal] Tenant discovered via getAppDataCloud fallback ✅');
                        }
                    }
                }
            } catch (discoveryErr) {
                console.warn('[Portal] Direct discovery failed:', discoveryErr.message);
            }
        }

        if (!tenant) {
            console.log('[DEBUG] FAIL: No tenant found with code:', searchCode);
            console.log('[DEBUG] Available codes:', registry.tenants ? registry.tenants.map(t => (t.code || '').toUpperCase()) : 'none');
            if (loginBtn) loginBtn.classList.remove('loading');
            showPortalError(`Invalid tenant code "${tenantCode}". Please check and try again.`);
            return false;
        }

        if (tenant.status !== 'Active') {
            if (loginBtn) loginBtn.classList.remove('loading');
            showPortalError('This tenant account is suspended. Contact administrator.');
            return false;
        }

        // VALIDATION: Check primary phone OR check sub-users
        const tenantPhone = normalizePhone(tenant.phone);
        let loginAsRole = 'Tenant';
        let sessionName = tenant.name;
        let phoneMatch = (tenantPhone === normalizedPhone);

        // If primary phone doesn't match, we NEED to check the sub-users in the tenant's cloud data
        if (!phoneMatch) {
            console.log('[Portal] Primary phone mismatch, checking sub-users...');
            activateTenantScope(tenantCode);

            if (typeof getAppDataCloud === 'function') {
                const cloudData = await getAppDataCloud();
                if (cloudData && cloudData.users) {
                    const foundUser = cloudData.users.find(u => normalizePhone(u.phone) === normalizedPhone);
                    if (foundUser) {
                        if (foundUser.status === 'Suspended') {
                            if (loginBtn) loginBtn.classList.remove('loading');
                            showPortalError('Your user account is suspended. Contact your administrator.');
                            return false;
                        }
                        phoneMatch = true;
                        loginAsRole = foundUser.role;
                        sessionName = foundUser.name;
                        appData = cloudData;
                        console.log('[Portal] Sub-user login verified:', foundUser.name);
                    }
                }
            }
        }

        if (!phoneMatch) {
            if (loginBtn) loginBtn.classList.remove('loading');
            showPortalError('Phone number does not match any account for this tenant.');
            return false;
        }

        // SUCCESS - Setup session
        const session = {
            type: 'tenant',
            tenantCode: tenantCode,
            tenantId: tenant.id,
            tenantName: tenant.name,
            phone: normalizedPhone,
            name: sessionName,
            role: loginAsRole,
            loginTime: new Date().toISOString()
        };
        saveSession(session);

        // Load cloud data for this tenant (ensures all receipts, clients appear on any device)
        if (typeof activateTenantScopeCloud === 'function') {
            await activateTenantScopeCloud(tenantCode);
        } else {
            activateTenantScope(tenantCode);
        }

        appData.user = {
            phone: normalizedPhone,
            name: sessionName,
            role: loginAsRole,
            tenantCode: tenantCode,
            loginTime: session.loginTime
        };
        saveAppData(appData);

        if (loginBtn) loginBtn.classList.remove('loading');
        if (successMsg) {
            const st = successMsg.querySelector('#successText');
            if (st) st.textContent = 'Welcome, ' + sessionName + '! Loading...';
            successMsg.classList.add('visible');
        }

        setTimeout(() => {
            const pl = document.getElementById('portalLogin');
            if (pl) pl.classList.remove('active');
            if (typeof showApp === 'function') showApp();
            if (typeof showToast === 'function') showToast('Welcome, ' + sessionName + '!', 'success');
        }, 800);

    } catch (err) {
        console.error('[Portal] Login Error:', err);
        if (loginBtn) loginBtn.classList.remove('loading');
        showPortalError('A system error occurred. Please refresh and try again.');
    }

    return false;
}

/**
 * Handles the Host Admin login process.
 * Fixed to work across different PCs by:
 * 1. Waiting longer for cloud sync with retries
 * 2. Always trusting cloud registry over local defaults
 * 3. Allowing first-time setup when no real host exists yet
 */
async function handleHostPortalLogin(e) {
    if (e) e.preventDefault();
    const loginBtn = document.getElementById('hostLoginBtn');
    const errorMsg = document.getElementById('errorMsg');
    const successMsg = document.getElementById('successMsg');

    if (errorMsg) errorMsg.classList.remove('visible');
    if (successMsg) successMsg.classList.remove('visible');

    const username = document.getElementById('hostUsername').value.trim();
    const name = document.getElementById('hostName').value.trim();
    const hostname = document.getElementById('hostHostname').value.trim();
    const phone = document.getElementById('hostPhone').value.trim();

    if (!username) { showPortalError('Please enter your username.'); return false; }
    if (!name) { showPortalError('Please enter your full name.'); return false; }
    if (!hostname) { showPortalError('Please enter a hostname.'); return false; }
    if (!phone || phone.length < 6) { showPortalError('Please enter a valid phone number.'); return false; }

    if (loginBtn) loginBtn.classList.add('loading');

    try {
        // STEP 1: Try to get cloud registry (with extended timeout and retries)
        let cloudSyncSuccess = false;
        if (typeof waitForRegistrySync === 'function') {
            console.log('[Portal] Host login: waiting for cloud registry sync...');
            cloudSyncSuccess = await waitForRegistrySync(12000); // Extended timeout for host login
        }

        // STEP 2: If first sync attempt failed, try one more direct fetch
        if (!cloudSyncSuccess && window.firebaseReady && typeof getRegistryCloud === 'function') {
            console.log('[Portal] Host login: retrying direct cloud fetch...');
            await new Promise(r => setTimeout(r, 2000)); // Wait 2s before retry
            try {
                await getRegistryCloud();
                cloudSyncSuccess = !!window.registrySyncedCloud;
            } catch (retryErr) {
                console.warn('[Portal] Retry cloud fetch failed:', retryErr.message);
            }
        }

        const registry = getRegistry();
        const normalizedPhone = normalizePhone(phone);
        const DEFAULT_PHONE = normalizePhone('+60123456789');
        const OLD_DEFAULT = normalizePhone('+60198765432');

        if (registry.host && registry.host.phone) {
            const existingPhone = normalizePhone(registry.host.phone);
            const isDefault = (existingPhone === DEFAULT_PHONE || existingPhone === OLD_DEFAULT);

            if (!isDefault && existingPhone !== normalizedPhone) {
                // Real host exists with different phone - check if cloud had data
                if (cloudSyncSuccess) {
                    // Cloud was synced and host phone still doesn't match: access denied
                    if (loginBtn) loginBtn.classList.remove('loading');
                    showPortalError('Host account already exists with a different phone number. Access denied.');
                    return false;
                } else {
                    // Cloud sync failed - the local data might be stale/wrong
                    // Show a helpful message suggesting to check network
                    if (loginBtn) loginBtn.classList.remove('loading');
                    showPortalError('Unable to verify host credentials (cloud sync failed). Please check your internet connection and try again.');
                    return false;
                }
            }
        }

        // STEP 3: Update host in registry
        registry.host = {
            phone: normalizedPhone,
            name: name,
            username: username,
            hostname: hostname,
            createdAt: (registry.host && registry.host.createdAt) ? registry.host.createdAt : new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        saveRegistry(registry);

        localStorage.setItem('transitpay_host_credentials', JSON.stringify({
            username: username, name: name, hostname: hostname, phone: normalizedPhone
        }));

        const session = {
            type: 'host',
            tenantCode: 'HOST',
            phone: normalizedPhone,
            name: name,
            username: username,
            hostname: hostname,
            role: 'Host Admin',
            loginTime: new Date().toISOString()
        };
        saveSession(session);

        // Load cloud data for HOST (ensures all data appears on any device)
        if (typeof activateTenantScopeCloud === 'function') {
            await activateTenantScopeCloud('HOST');
        } else {
            activateTenantScope('HOST');
        }

        appData.user = {
            phone: normalizedPhone,
            name: name,
            username: username,
            hostname: hostname,
            role: 'Host Admin',
            tenantCode: 'HOST',
            loginTime: session.loginTime
        };
        saveAppData(appData);

        if (loginBtn) loginBtn.classList.remove('loading');
        if (successMsg) {
            const st = successMsg.querySelector('#successText');
            if (st) st.textContent = 'Welcome, ' + name + '! Opening dashboard...';
            successMsg.classList.add('visible');
        }

        setTimeout(() => {
            const pl = document.getElementById('portalLogin');
            if (pl) pl.classList.remove('active');
            if (typeof showApp === 'function') showApp();
            if (typeof showToast === 'function') showToast('Welcome, ' + name + '!', 'success');
        }, 800);

    } catch (err) {
        console.error('[Portal] Host Login Error:', err);
        if (loginBtn) loginBtn.classList.remove('loading');
        showPortalError('System error during host login. Please check your internet connection and try again.');
    }

    return false;
}

/**
 * Initializes the portal page.
 * Cloud sync is attempted FIRST before local seeding to prevent
 * overwriting cloud data with defaults on new PCs.
 */
async function portalInit() {
    // STEP 0: Inject known tenants immediately so login works without cloud sync
    injectKnownTenants();

    // STEP 1: Try to fetch cloud registry FIRST before seeding local defaults
    let cloudRegistryLoaded = false;
    if (typeof getRegistryCloud === 'function') {
        try {
            console.log('[Portal] Fetching cloud registry before local seed...');
            const cloudReg = await getRegistryCloud();
            if (cloudReg) {
                cloudRegistryLoaded = true;
                console.log('[Portal] Cloud registry loaded successfully ✅');
            }
        } catch (err) {
            console.warn('[Portal] Cloud registry fetch failed, will use local:', err.message);
        }
    }

    // STEP 2: Only seed demo tenant if cloud didn't provide a registry
    if (!cloudRegistryLoaded) {
        ensureDemoTenant();
    } else {
        // Even after cloud sync, ensure tenants array and basic structure
        const data = localStorage.getItem(PORTAL_REGISTRY_KEY);
        if (data) {
            try {
                const registry = JSON.parse(data);
                if (!registry.tenants) registry.tenants = [];
                localStorage.setItem(PORTAL_REGISTRY_KEY, JSON.stringify(registry));
            } catch (e) {
                console.error('[Portal] Failed to validate synced registry:', e);
                ensureDemoTenant(); // Fallback
            }
        } else {
            ensureDemoTenant(); // Fallback if cloud returned null
        }
    }

    const urlParams = new URLSearchParams(window.location.search);
    const codeFromUrl = urlParams.get('code');
    const modeFromUrl = urlParams.get('mode');

    if (codeFromUrl) {
        const codeInput = document.getElementById('tenantCodeInput');
        if (codeInput) codeInput.value = codeFromUrl.toUpperCase();
    }

    if (modeFromUrl === 'host') {
        switchTab('host');
    }

    loadSavedHostCredentials();
    console.log('[TransitPay] Portal Auth initialized ✅');
}

// Run init when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Only init if we are on the portal page (checking for essential elements)
    if (document.getElementById('portalLogin')) {
        portalInit();
    }
});
