/* ============================
   TRANSITPAY - Firebase / Firestore Database Layer
   Replaces localStorage with cloud storage.
   All data is synced across devices in real-time.
   ============================ */

// ==================== FIREBASE CONFIG ====================
const firebaseConfig = {
    apiKey: "AIzaSyAP9qvV3TE4BhA6hk4zJDkICTbrN93Z63k",
    authDomain: "transitpay-e445.firebaseapp.com",
    projectId: "transitpay-e445",
    storageBucket: "transitpay-e445.firebasestorage.app",
    messagingSenderId: "900738758923",
    appId: "1:900738758923:web:d1bf99f339bdb135130a0e",
    measurementId: "G-GF21HMZ445"
};

// ==================== INIT FIREBASE ====================
let db = null;
window.firebaseReady = false;
window.registrySynced = false;
window._firebaseInitPromise = null; // Track the init promise so callers can await it

/**
 * Initialize Firebase with proper async handling.
 * Key fix: We AWAIT anonymous auth before marking firebaseReady = true.
 * This prevents Firestore reads from failing with "client is offline"
 * because auth hasn't completed yet.
 */
/**
 * Detect if we're in Incognito / Private Browsing mode.
 * In Incognito, IndexedDB persistence causes Firestore to get stuck offline.
 */
async function isIncognitoMode() {
    try {
        // Try writing to IndexedDB - in some Incognito modes this fails or has limited storage
        const testDb = indexedDB.open('__transitpay_test');
        return new Promise((resolve) => {
            testDb.onerror = () => resolve(true);
            testDb.onsuccess = () => {
                // Check storage estimate - Incognito typically has very limited quota
                if (navigator.storage && navigator.storage.estimate) {
                    navigator.storage.estimate().then(est => {
                        // Incognito usually has < 120MB quota
                        resolve(est.quota < 120000000);
                    }).catch(() => resolve(false));
                } else {
                    resolve(false);
                }
                // Clean up test DB
                try { indexedDB.deleteDatabase('__transitpay_test'); } catch (e) { }
            };
        });
    } catch (e) {
        return true; // If we can't even open IndexedDB, likely restricted
    }
}

/**
 * Reset Firestore network connection.
 * This "kicks" Firestore out of a stuck offline state.
 */
async function resetFirestoreNetwork() {
    if (!db) return false;
    try {
        console.log('[TransitPay] Resetting Firestore network connection...');
        await db.disableNetwork();
        await new Promise(r => setTimeout(r, 2000)); // Longer pause to let connections clear
        await db.enableNetwork();
        await new Promise(r => setTimeout(r, 1000)); // Wait for reconnection
        console.log('[TransitPay] Network reset complete ✅');
        return true;
    } catch (err) {
        console.warn('[TransitPay] Network reset failed:', err.message);
        return false;
    }
}

async function initFirebase() {
    try {
        // Delete ALL existing Firebase app instances first.
        // This guarantees a fresh Firestore instance so db.settings() works.
        for (const app of [...(firebase.apps || [])]) {
            try { await app.delete(); } catch (e) { /* ignore */ }
        }

        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();

        // Settings() now guaranteed to work on brand-new Firestore instance
        db.settings({ experimentalForceLongPolling: true });
        console.log('[TransitPay] Force long-polling enabled ✅ (HTTPS mode)');

        // Force network on
        try { await db.enableNetwork(); } catch (e) { /* ignore */ }

        // Await anonymous auth (with shorter timeout so app loads faster)
        if (firebase.auth) {
            try {
                await Promise.race([
                    firebase.auth().signInAnonymously(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Auth timeout')), 10000))
                ]);
                const user = firebase.auth().currentUser;
                console.log('[TransitPay] Auth ✅ uid:', user ? user.uid : 'none');
                window._firebaseAuthUid = user ? user.uid : null;
            } catch (authErr) {
                console.warn('[TransitPay] Auth failed (continuing anyway):', authErr.code, authErr.message);
                window._firebaseAuthError = authErr.message;
            }
        }

        // Mark Firebase as READY immediately — don't block on a connectivity test
        // Individual reads will fail on their own if truly offline
        window.firebaseReady = true;
        window._firebaseOnline = true; // Assume online; forceSyncFromCloud will verify
        window._firebaseConnectError = null;
        console.log('[TransitPay] Firebase ready ✅');

        // Show brief connected banner
        _showFirebaseDiagnostic(true, null);

        // Background connectivity test — doesn't block the app
        setTimeout(async () => {
            try {
                await Promise.race([
                    db.collection('config').doc('registry').get(),
                    new Promise((_, rej) => setTimeout(() => rej(new Error('bg-timeout')), 8000))
                ]);
                console.log('[TransitPay] Background connectivity test: online ✅');
                window._firebaseOnline = true;
            } catch (bgErr) {
                console.warn('[TransitPay] Background connectivity test failed:', bgErr.message);
                window._firebaseOnline = false;
                window._firebaseConnectError = bgErr.message;
                // Show a non-blocking warning banner
                _showFirebaseDiagnostic(false, bgErr.message);
            }
        }, 2000); // Wait 2s after app loads before testing

    } catch (err) {
        console.warn('[TransitPay] Firebase init failed:', err.message);
        window.firebaseReady = false;
        window._firebaseOnline = false;
        window._firebaseConnectError = err.message;
        _showFirebaseDiagnostic(false, err.message);
    }
}


/**
 * Shows a temporary on-screen banner with Firebase status.
 * Visible on mobile where we can't open DevTools.
 * Auto-hides after 8 seconds if connected, stays if failed.
 */
function _showFirebaseDiagnostic(isOnline, error) {
    // Only show on first load, and only briefly if connected
    const existing = document.getElementById('_fbDiag');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id = '_fbDiag';
    banner.style.cssText = `
        position:fixed; bottom:70px; left:50%; transform:translateX(-50%);
        background:${isOnline ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'};
        border:1px solid ${isOnline ? '#22c55e' : '#ef4444'};
        color:${isOnline ? '#86efac' : '#fca5a5'};
        padding:0.5rem 1rem; border-radius:8px; font-size:0.75rem;
        z-index:99999; text-align:center; max-width:90vw;
        backdrop-filter:blur(10px); font-family:monospace; cursor:pointer;
    `;
    // Always tap-to-dismiss
    banner.onclick = () => banner.remove();
    banner.title = 'Tap to dismiss';

    const uid = window._firebaseAuthUid;
    if (isOnline) {
        banner.textContent = `✅ Firebase connected | uid: ${uid ? uid.substring(0, 8) + '...' : 'none'}`;
        setTimeout(() => banner.remove(), 5000);
    } else {
        // Show a friendlier message — login still works via local cache
        banner.innerHTML = `⚠️ Cloud sync unavailable — offline mode<br><small>Login still works. Tap to dismiss.</small>`;
        // Auto-dismiss after 8s so it doesn't block the login flow
        setTimeout(() => { if (banner.parentNode) banner.remove(); }, 8000);
    }

    // Wait for DOM to be ready
    if (document.body) {
        document.body.appendChild(banner);
    } else {
        document.addEventListener('DOMContentLoaded', () => document.body.appendChild(banner));
    }
}



// function to retry init if failed
async function ensureFirebase() {
    if (window.firebaseReady) return true;
    if (typeof firebase !== 'undefined') {
        if (!window._firebaseInitPromise) {
            window._firebaseInitPromise = initFirebase();
        }
        await window._firebaseInitPromise;
        return window.firebaseReady;
    }
    return false;
}

// Call init immediately (store promise so others can await it)
if (typeof firebase !== 'undefined') {
    window._firebaseInitPromise = initFirebase();
} else {
    console.warn('[TransitPay] Firebase SDK not loaded yet. Will retry on first data call.');
}

/**
 * FORCE SYNC FROM CLOUD
 * Clears the local localStorage cache for the active tenant + registry,
 * then re-fetches everything fresh from Firestore.
 * Use this when a device shows different/stale data vs another device.
 */
async function forceSyncFromCloud() {
    if (typeof showToast === 'function') showToast('🔄 Syncing from cloud...', 'info');
    console.log('[TransitPay] === FORCE SYNC START ===');

    // Show progress banner
    let diagBanner = document.getElementById('_forceSyncBanner');
    if (!diagBanner) {
        diagBanner = document.createElement('div');
        diagBanner.id = '_forceSyncBanner';
        diagBanner.style.cssText = `
            position:fixed; top:70px; left:50%; transform:translateX(-50%);
            background:rgba(99,102,241,0.25); border:1px solid #6366f1;
            color:#a5b4fc; padding:0.75rem 1.5rem; border-radius:10px;
            font-size:0.8rem; z-index:99999; text-align:center;
            max-width:92vw; backdrop-filter:blur(10px); font-family:monospace;
            line-height:1.5;
        `;
        document.body.appendChild(diagBanner);
    }
    diagBanner.textContent = '🔄 Connecting to Firebase...';

    // ALWAYS try a fresh reconnect — don't trust the cached _firebaseOnline value
    // (it may have been set false during initial load but network is fine now)
    try {
        if (db) {
            await db.enableNetwork();
            console.log('[TransitPay] Force sync: Network re-enabled');
        }
    } catch (netErr) {
        console.warn('[TransitPay] Force sync: enableNetwork failed:', netErr.message);
    }

    // Wait for Firebase init if not ready
    if (!window.firebaseReady && window._firebaseInitPromise) {
        diagBanner.textContent = '🔄 Waiting for Firebase init...';
        try {
            await Promise.race([
                window._firebaseInitPromise,
                new Promise(r => setTimeout(r, 12000))
            ]);
        } catch (e) { /* ignore */ }
    }

    // If still not ready, try re-initialising
    if (!window.firebaseReady) {
        diagBanner.textContent = '🔄 Re-initialising Firebase...';
        try {
            window._firebaseInitPromise = initFirebase();
            await Promise.race([
                window._firebaseInitPromise,
                new Promise(r => setTimeout(r, 15000))
            ]);
        } catch (e) {
            console.warn('[TransitPay] Force sync: Re-init failed:', e.message);
        }
    }

    // Do a direct Firestore test read regardless of cached _firebaseOnline flag
    diagBanner.textContent = '🔄 Testing Firestore connection...';
    let firestoreWorking = false;
    let firestoreError = '';
    if (window.firebaseReady && db) {
        try {
            await Promise.race([
                db.collection('config').doc('registry').get(),
                new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout 15s')), 15000))
            ]);
            firestoreWorking = true;
            window._firebaseOnline = true;
            console.log('[TransitPay] Force sync: Firestore test read ✅');
        } catch (testErr) {
            firestoreError = testErr.code || testErr.message || 'unknown';
            console.warn('[TransitPay] Force sync: Firestore test read failed:', firestoreError);
        }
    }

    if (!firestoreWorking) {
        // Show specific helpful message based on error type
        diagBanner.style.background = 'rgba(239,68,68,0.2)';
        diagBanner.style.borderColor = '#ef4444';
        diagBanner.style.color = '#fca5a5';

        const isPermission = firestoreError.includes('permission') || firestoreError.includes('PERMISSION_DENIED');
        const isOffline = firestoreError.includes('offline') || firestoreError.includes('unavailable') || firestoreError.includes('Timeout');

        if (isPermission) {
            diagBanner.innerHTML = `❌ Firebase Rules blocking access<br><small>Go to Firebase Console → Firestore → Rules → set allow read, write: if true;</small>`;
        } else if (!window.firebaseReady) {
            diagBanner.innerHTML = `❌ Firebase not initialised<br><small>Check your internet and reload the page</small>`;
        } else {
            diagBanner.innerHTML = `❌ Cannot reach Firestore (${firestoreError})<br><small>Check Firebase Console → Auth → Anonymous sign-in enabled?</small>`;
        }
        setTimeout(() => { if (diagBanner.parentNode) diagBanner.remove(); }, 12000);
        return false;
    }


    diagBanner.textContent = '🔄 Fetching registry from cloud...';

    // Step 1: Clear and re-fetch registry
    try {
        localStorage.removeItem('transitpay_registry');
        const freshReg = await fsGetRegistry();
        if (freshReg) {
            localStorage.setItem('transitpay_registry', JSON.stringify(freshReg));
            console.log('[TransitPay] Force sync: Registry loaded ✅', freshReg.tenants ? freshReg.tenants.length + ' tenants' : '');
        } else {
            console.warn('[TransitPay] Force sync: Registry not found in cloud.');
        }
    } catch (regErr) {
        console.warn('[TransitPay] Force sync: Registry fetch failed:', regErr.message);
    }

    // Step 2: Clear and re-fetch tenant app data
    const tenantCode = getActiveTenantCode();
    const storageKey = window._ACTIVE_STORAGE_KEY || 'transitpay_data';

    diagBanner.textContent = `🔄 Fetching data for ${tenantCode}...`;
    console.log('[TransitPay] Force sync: Fetching tenant data for', tenantCode, '(key:', storageKey, ')');

    try {
        localStorage.removeItem(storageKey);
        const freshData = await fsGetAppData(tenantCode);
        if (freshData) {
            // Preserve current user session
            const currentUser = (typeof appData !== 'undefined' && appData) ? appData.user : null;
            window.appData = freshData;
            if (currentUser) window.appData.user = currentUser;
            localStorage.setItem(storageKey, JSON.stringify(freshData));

            const rc = (freshData.receipts || []).length;
            const cl = (freshData.clients || []).length;
            const pt = (freshData.petrolExpenses || []).length;
            console.log(`[TransitPay] Force sync: ✅ ${tenantCode} — ${rc} receipts, ${cl} clients, ${pt} petrol`);

            diagBanner.style.background = 'rgba(34,197,94,0.15)';
            diagBanner.style.borderColor = '#22c55e';
            diagBanner.style.color = '#86efac';
            diagBanner.textContent = `✅ Synced! ${rc} receipts · ${cl} clients · ${pt} petrol entries`;
            setTimeout(() => { if (diagBanner.parentNode) diagBanner.remove(); }, 6000);

            // Refresh all UI
            if (typeof updateDashboard === 'function') updateDashboard();
            if (typeof loadReceipts === 'function') loadReceipts();
            if (typeof loadClients === 'function') loadClients();
            if (typeof loadPetrolExpenses === 'function') loadPetrolExpenses();
            if (typeof loadTrips === 'function') loadTrips();
            if (typeof loadUsers === 'function') loadUsers();
            if (typeof populateClientDropdown === 'function') populateClientDropdown();

            if (typeof showToast === 'function') showToast(`✅ Synced! ${rc} receipts, ${cl} clients`, 'success');
            return true;
        } else {
            diagBanner.style.background = 'rgba(245,158,11,0.15)';
            diagBanner.style.borderColor = '#f59e0b';
            diagBanner.style.color = '#fcd34d';
            diagBanner.textContent = `⚠️ No data found in cloud for "${tenantCode}". Data may not have been saved yet.`;
            setTimeout(() => { if (diagBanner.parentNode) diagBanner.remove(); }, 8000);
            console.warn('[TransitPay] Force sync: No data found in Firestore for', tenantCode);
            if (typeof showToast === 'function') showToast(`⚠️ No cloud data found for ${tenantCode}`, 'warning');
            return false;
        }
    } catch (err) {
        diagBanner.style.background = 'rgba(239,68,68,0.2)';
        diagBanner.style.borderColor = '#ef4444';
        diagBanner.style.color = '#fca5a5';
        diagBanner.textContent = `❌ Sync failed: ${err.message}`;
        setTimeout(() => { if (diagBanner.parentNode) diagBanner.remove(); }, 8000);
        console.error('[TransitPay] Force sync: Fetch failed:', err);
        return false;
    }
}

// ==================== HELPERS ====================
// Sanitize tenant code for use as Firestore document ID
function sanitizeTenantCode(code) {
    return (code || 'HOST').toUpperCase().replace(/[^A-Z0-9_-]/g, '_');
}

// Get the active tenant code
function getActiveTenantCode() {
    return window._ACTIVE_TENANT_CODE || 'HOST';
}

// ==================== FIRESTORE PATHS ====================
// Each tenant gets their own document in the "tenants" collection
// Registry (tenant list) is stored in a shared "registry" document

function getTenantDocRef(tenantCode) {
    const code = sanitizeTenantCode(tenantCode || getActiveTenantCode());
    return db.collection('tenants').doc(code);
}

function getRegistryDocRef() {
    return db.collection('config').doc('registry');
}

// ==================== REGISTRY (Tenant List) ====================
async function fsGetRegistry() {
    if (!window.firebaseReady) {
        // Wait for init to complete if it's in progress
        if (window._firebaseInitPromise) {
            await window._firebaseInitPromise;
        }
        if (!window.firebaseReady) return null;
    }
    try {
        // Use a timeout to prevent hanging forever
        const snap = await Promise.race([
            getRegistryDocRef().get(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Registry fetch timeout (20s)')), 20000))
        ]);

        if (snap.exists) {
            window.registrySynced = true;
            window.registrySyncedCloud = true;
            console.log('[FS] Registry fetched from cloud ✅');
            return snap.data();
        }
        console.log('[FS] Registry document does not exist in cloud');
        return null;
    } catch (err) {
        console.error('[FS] getRegistry error:', err.message);
        // If offline, skip expensive network reset — just fall back to cache immediately
        // The network reset (disable+enable+wait 3s) adds unnecessary delay during login
        window.registrySyncedCloud = false;
        return null;
    }
}

// Function to wait for registry sync
// waitForRegistrySync moved to js/utils.js


async function fsSaveRegistry(registry) {
    if (!window.firebaseReady) return;
    try {
        await getRegistryDocRef().set(registry, { merge: true });
    } catch (err) {
        console.error('[FS] saveRegistry error:', err);
    }
}

// ==================== APP DATA (Per Tenant) ====================
async function fsGetAppData(tenantCode) {
    if (!window.firebaseReady) {
        if (window._firebaseInitPromise) {
            await window._firebaseInitPromise;
        }
        if (!window.firebaseReady) return null;
    }
    try {
        const snap = await Promise.race([
            getTenantDocRef(tenantCode).get(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('AppData fetch timeout (20s)')), 20000))
        ]);
        if (snap.exists) {
            return snap.data();
        }
        return null;
    } catch (err) {
        console.error(`[FS] getAppData error for ${tenantCode}:`, err.message);
        // If offline, skip expensive network reset — fall back to localStorage cache immediately
        return null;
    }
}

async function fsSaveAppData(tenantCode, data) {
    if (!window.firebaseReady) return;
    try {
        // Remove undefined values (Firestore doesn't accept them)
        const clean = JSON.parse(JSON.stringify(data));
        await getTenantDocRef(tenantCode).set(clean, { merge: true });
        console.log(`[FS] AppData saved to Firestore for ${tenantCode} ✅`);
    } catch (err) {
        console.warn('[FS] saveAppData first attempt failed:', err.message);
        // Retry once after network reset
        if (err.message && err.message.toLowerCase().includes('offline')) {
            try {
                await resetFirestoreNetwork();
                const clean = JSON.parse(JSON.stringify(data));
                await getTenantDocRef(tenantCode).set(clean, { merge: true });
                console.log(`[FS] AppData saved after network reset for ${tenantCode} ✅`);
            } catch (retryErr) {
                console.error('[FS] saveAppData retry also failed:', retryErr.message);
                // Queue for next time Firebase is ready
                window._pendingSave = { tenantCode, data };
                console.warn('[FS] Data queued for next sync attempt.');
            }
        } else {
            console.error('[FS] saveAppData error:', err);
        }
    }
}

// ==================== SYNC: localStorage → Firestore ====================
// Migrates existing localStorage data to Firestore on first login
async function migrateLocalStorageToFirestore(tenantCode) {
    if (!window.firebaseReady) return;
    const code = sanitizeTenantCode(tenantCode);
    const localKey = getTenantStorageKey(code);
    const localRaw = localStorage.getItem(localKey);
    if (!localRaw) return; // No local data to migrate for this tenant

    try {
        const existing = await fsGetAppData(code);
        if (existing && existing._migrated) return; // already migrated

        const localData = JSON.parse(localRaw);
        localData._migrated = true;
        localData._migratedAt = new Date().toISOString();
        await fsSaveAppData(code, localData);
        console.log('[TransitPay] Migrated localStorage → Firestore for tenant:', code);
    } catch (err) {
        console.warn('[TransitPay] Migration failed:', err);
    }
}

async function migrateRegistryToFirestore() {
    if (!window.firebaseReady) return;
    const localRaw = localStorage.getItem('transitpay_registry');
    if (!localRaw) return;
    try {
        const existing = await fsGetRegistry();
        if (existing && existing._migrated) return;
        const localData = JSON.parse(localRaw);
        localData._migrated = true;
        await fsSaveRegistry(localData);
        console.log('[TransitPay] Migrated registry localStorage → Firestore');
    } catch (err) {
        console.warn('[TransitPay] Registry migration failed:', err);
    }
}

// ==================== OVERRIDE CORE FUNCTIONS ====================
// These replace the localStorage-based getAppData/saveAppData/getRegistry/saveRegistry
// with async Firestore versions, while keeping localStorage as a fast local cache.

// We patch the functions after DOM loads to avoid race conditions
window._fsPatched = false;

async function patchWithFirestore() {
    if (window._fsPatched || !window.firebaseReady) return;
    window._fsPatched = true;

    // Migrate existing data first
    await migrateRegistryToFirestore();

    console.log('[TransitPay] Firestore patch applied ✅');
}

// ==================== REAL-TIME LISTENER ====================
// Listen for changes to the active tenant's data and auto-refresh the UI
let _unsubscribeTenantListener = null;

function startRealtimeSync(tenantCode) {
    if (!window.firebaseReady) return;
    if (_unsubscribeTenantListener) _unsubscribeTenantListener();

    const code = sanitizeTenantCode(tenantCode);
    _unsubscribeTenantListener = getTenantDocRef(code).onSnapshot(snap => {
        if (!snap.exists) return;
        const freshData = snap.data();

        // Merge into appData without overwriting user session
        const currentUser = appData ? appData.user : null;
        appData = { ...freshData };
        if (currentUser) appData.user = currentUser;

        // Refresh visible UI
        if (typeof updateDashboard === 'function') updateDashboard();
        if (typeof loadReceipts === 'function') loadReceipts();
        if (typeof loadClients === 'function') loadClients();
        if (typeof loadPetrolExpenses === 'function') loadPetrolExpenses();
        if (typeof loadTrips === 'function') loadTrips();

        console.log('[TransitPay] Real-time sync received ✅');
    }, err => {
        console.warn('[TransitPay] Real-time listener error:', err);
    });
}

function stopRealtimeSync() {
    if (_unsubscribeTenantListener) {
        _unsubscribeTenantListener();
        _unsubscribeTenantListener = null;
    }
}

// ==================== ENHANCED saveAppData ====================
// Wraps the original saveAppData to also write to Firestore
const _originalSaveAppData = window.saveAppData;

window.saveAppDataCloud = async function (data) {
    // Always save to localStorage first (instant, works offline)
    const key = window._ACTIVE_STORAGE_KEY || 'transitpay_data';
    localStorage.setItem(key, JSON.stringify(data));

    // Then save to Firestore in background
    if (window.firebaseReady) {
        const tenantCode = getActiveTenantCode();
        await fsSaveAppData(tenantCode, data);
    }
};


/**
 * Helper: merge two arrays by 'id' field. Cloud items are kept, local items are added/updated.
 */
function mergeArrayById(cloudArr, localArr) {
    const merged = [...cloudArr];
    for (const localItem of localArr) {
        const existingIdx = merged.findIndex(c => c.id === localItem.id);
        if (existingIdx >= 0) {
            merged[existingIdx] = localItem; // Update existing
        } else {
            merged.push(localItem); // Add new
        }
    }
    return merged;
}

// ==================== ENHANCED getAppData ====================
window.getAppDataCloud = async function () {
    const tenantCode = getActiveTenantCode();

    // Wait for Firebase init to complete if in progress
    if (window._firebaseInitPromise && !window.firebaseReady) {
        await window._firebaseInitPromise;
    }

    // Try Firestore first
    if (window.firebaseReady) {
        const fsData = await fsGetAppData(tenantCode);
        if (fsData) {
            // Also update localStorage cache
            const key = window._ACTIVE_STORAGE_KEY || 'transitpay_data';
            localStorage.setItem(key, JSON.stringify(fsData));
            return fsData;
        }
    }

    // Fallback to localStorage
    const key = window._ACTIVE_STORAGE_KEY || 'transitpay_data';
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
};

// ==================== ENHANCED Registry ====================
window.getRegistryCloud = async function () {
    // Wait for Firebase init to complete if in progress
    if (window._firebaseInitPromise && !window.firebaseReady) {
        console.log('[TransitPay] Waiting for Firebase init before registry fetch...');
        await window._firebaseInitPromise;
    }

    if (!window.firebaseReady) {
        console.warn('[TransitPay] Firebase not ready for getRegistryCloud, using local.');
    } else {
        const fsReg = await fsGetRegistry();
        if (fsReg) {
            localStorage.setItem('transitpay_registry', JSON.stringify(fsReg));
            return fsReg;
        }
    }
    const raw = localStorage.getItem('transitpay_registry');
    return raw ? JSON.parse(raw) : null;
};

window.saveRegistryCloud = async function (registry) {
    // CRITICAL: Before saving to cloud, fetch the cloud version and MERGE tenants.
    // This prevents a new PC (which only has DEMO locally) from overwriting
    // the cloud registry that has all the real tenants (MAYA, etc.)
    if (window.firebaseReady) {
        try {
            const cloudReg = await fsGetRegistry();
            if (cloudReg && cloudReg.tenants && cloudReg.tenants.length > 0) {
                // Merge: keep all cloud tenants, add/update local ones
                const mergedTenants = [...cloudReg.tenants];
                const localTenants = registry.tenants || [];

                for (const localTenant of localTenants) {
                    const existingIdx = mergedTenants.findIndex(t =>
                        t.id === localTenant.id || t.code === localTenant.code
                    );
                    if (existingIdx >= 0) {
                        // Update existing tenant with local changes
                        mergedTenants[existingIdx] = localTenant;
                    } else {
                        // Add new tenant from local
                        mergedTenants.push(localTenant);
                    }
                }

                registry.tenants = mergedTenants;
                console.log('[TransitPay] Registry merged with cloud ✅ (' + mergedTenants.length + ' tenants)');
            }
        } catch (mergeErr) {
            console.warn('[TransitPay] Could not merge with cloud registry:', mergeErr.message);
        }

        await fsSaveRegistry(registry);
    }

    // Save merged result to localStorage
    localStorage.setItem('transitpay_registry', JSON.stringify(registry));
};

console.log('[TransitPay] firebase-db.js loaded ✅');
