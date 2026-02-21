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


function initFirebase() {
    try {
        if (!firebase.apps || firebase.apps.length === 0) {
            firebase.initializeApp(firebaseConfig);
        }
        db = firebase.firestore();

        // Enable long polling and disable fetch streams to bypass potential proxy/firewall issues
        // This is the most resilient combination for restricted networks.
        db.settings({
            experimentalForceLongPolling: true,
            useFetchStreams: false
        });

        // Try anonymous login to satisfy "authenticated only" security rules
        if (firebase.auth) {
            firebase.auth().signInAnonymously()
                .then(() => console.log('[TransitPay] Anonymous auth success ✅'))
                .catch(err => console.warn('[TransitPay] Anonymous auth failed (this is usually OK):', err.message));
        }

        // Enable offline persistence
        db.enablePersistence({ synchronizeTabs: true })
            .then(() => console.log('[TransitPay] Persistence enabled ✅'))
            .catch((err) => {
                if (err.code == 'failed-precondition') {
                    console.warn('[TransitPay] Persistence failed: Multiple tabs open');
                } else if (err.code == 'unimplemented') {
                    console.warn('[TransitPay] Persistence failed: Browser not supported');
                }
            });

        // Explicitly force network online
        if (typeof db.enableNetwork === 'function') {
            db.enableNetwork().catch(() => { });
        }

        window.firebaseReady = true;
        console.log('[TransitPay] Firebase initialized with High Resilience mode ✅');
    } catch (err) {
        console.warn('[TransitPay] Firebase init failed, using localStorage fallback:', err);
        window.firebaseReady = false;
    }
}

// function to retry init if failed
function ensureFirebase() {
    if (window.firebaseReady) return true;
    if (typeof firebase !== 'undefined') {
        initFirebase();
        return window.firebaseReady;
    }
    return false;
}

// Call init immediately
if (typeof firebase !== 'undefined') {
    initFirebase();
} else {
    console.warn('[TransitPay] Firebase SDK not loaded yet. Will retry on first data call.');
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
    if (!window.firebaseReady) return null;
    try {
        const snap = await getRegistryDocRef().get();
        if (snap.exists) {
            window.registrySynced = true;
            window.registrySyncedCloud = true; // NEW: track actual cloud sync
            return snap.data();
        }
        return null;
    } catch (err) {
        console.error('[FS] getRegistry error:', err.message);

        // If it says "offline", try to force network enablement immediately
        if (err.message && err.message.toLowerCase().includes('offline')) {
            console.warn('[FS] Client appears offline to Firestore. Attempting to force network...');
            if (db && typeof db.enableNetwork === 'function') {
                db.enableNetwork().catch(() => { });
            }
        }
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
    if (!window.firebaseReady) return null;
    try {
        const snap = await getTenantDocRef(tenantCode).get();
        if (snap.exists) {
            return snap.data();
        }
        return null;
    } catch (err) {
        console.error(`[FS] getAppData error for ${tenantCode}:`, err.message);
        if (err.message && err.message.toLowerCase().includes('offline')) {
            console.warn('[FS] Client appears offline. Re-requesting network...');
            if (db && typeof db.enableNetwork === 'function') {
                db.enableNetwork().catch(() => { });
            }
        }
        return null;
    }
}

async function fsSaveAppData(tenantCode, data) {
    if (!window.firebaseReady) return;
    try {
        // Remove undefined values (Firestore doesn't accept them)
        const clean = JSON.parse(JSON.stringify(data));
        await getTenantDocRef(tenantCode).set(clean, { merge: true });
    } catch (err) {
        console.error('[FS] saveAppData error:', err);
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

// ==================== ENHANCED getAppData ====================
window.getAppDataCloud = async function () {
    const tenantCode = getActiveTenantCode();

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
    if (!ensureFirebase()) {
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
    localStorage.setItem('transitpay_registry', JSON.stringify(registry));
    if (window.firebaseReady) {
        await fsSaveRegistry(registry);
    }
};

console.log('[TransitPay] firebase-db.js loaded ✅');
