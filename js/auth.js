/* ============================
   TRANSITPAY - Portal Authentication Logic
   Separated from portal.html for better maintainability.
   ============================ */

const PORTAL_REGISTRY_KEY = 'transitpay_registry';

/**
 * Ensures a DEMO tenant exists in the registry for testing/first-run.
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

    if (!registry) {
        registry = {
            host: {
                phone: '+60123456789',
                name: 'System Admin',
                createdAt: new Date().toISOString()
            },
            tenants: []
        };
    }

    // Ensure tenants array exists
    if (!registry.tenants) registry.tenants = [];

    // Migrate old default phone number if still present
    const OLD_PHONE = '+60198765432';
    const NEW_PHONE = '+60123456789';
    if (registry.host && registry.host.phone === OLD_PHONE) {
        registry.host.phone = NEW_PHONE;
        registry.host.name = 'System Admin';
    }

    const demoTenant = registry.tenants.find(t => t.code === 'DEMO');
    if (!demoTenant) {
        registry.tenants.push({
            id: 'TN-' + Date.now(),
            code: 'DEMO',
            name: 'Demo Transport',
            phone: NEW_PHONE,
            status: 'Active',
            notes: 'Primary tenant account',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
    } else if (demoTenant.phone === OLD_PHONE) {
        demoTenant.phone = NEW_PHONE;
    }

    if (!registry.host) {
        registry.host = {
            phone: NEW_PHONE,
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

            activateTenantScope(searchCode);
            try {
                if (typeof getAppDataCloud === 'function') {
                    const cloudData = await getAppDataCloud();
                    if (cloudData && cloudData.user && (cloudData.user.tenantCode || '').toUpperCase() === searchCode) {
                        tenant = {
                            id: cloudData.user.tenantId || ('TN-' + Date.now()),
                            code: searchCode,
                            name: cloudData.user.tenantName || searchCode,
                            phone: cloudData.user.phone,
                            status: 'Active',
                            isDiscovered: true
                        };
                        console.log('[Portal] Success! Tenant discovered via direct fetch ✅');
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
        activateTenantScope(tenantCode);

        if (!appData.users && typeof getAppDataCloud === 'function') {
            const cloudData = await getAppDataCloud();
            if (cloudData) appData = cloudData;
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
        if (typeof waitForRegistrySync === 'function') {
            await waitForRegistrySync(8000); // Increased timeout to match tenant login
        }

        const registry = getRegistry();
        const normalizedPhone = normalizePhone(phone);

        if (registry.host && registry.host.phone) {
            const existingPhone = normalizePhone(registry.host.phone);
            const DEFAULT_PHONE = normalizePhone('+60123456789');
            const OLD_DEFAULT = normalizePhone('+60198765432');

            // If it's the default placeholder host, allow the user to take it over correctly
            if (existingPhone !== normalizedPhone && existingPhone !== DEFAULT_PHONE && existingPhone !== OLD_DEFAULT) {
                if (loginBtn) loginBtn.classList.remove('loading');
                showPortalError('Host account already exists with a different phone number. Access denied.');
                return false;
            }
        }

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
        activateTenantScope('HOST');

        if (typeof getAppDataCloud === 'function') {
            const cloudData = await getAppDataCloud();
            if (cloudData) appData = cloudData;
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
        showPortalError('System error during host login.');
    }

    return false;
}

/**
 * Initializes the portal page.
 */
async function portalInit() {
    ensureDemoTenant();

    if (typeof getRegistryCloud === 'function') {
        await getRegistryCloud();
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
