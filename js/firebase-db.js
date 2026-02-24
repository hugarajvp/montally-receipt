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
async function initFirebase() {
    try {
        if (!firebase.apps || firebase.apps.length === 0) {
            firebase.initializeApp(firebaseConfig);
        }
        db = firebase.firestore();

        // Enable long polling and disable fetch streams to bypass proxy/firewall issues
        db.settings({
            experimentalForceLongPolling: true,
            useFetchStreams: false
        });

        // STEP 1: Try persistence FIRST (before auth, before any reads)
        // Use synchronizeTabs:false for better compatibility (especially Incognito)
        try {
            await db.enablePersistence({ synchronizeTabs: false });
            console.log('[TransitPay] Persistence enabled ✅');
        } catch (persistErr) {
            if (persistErr.code === 'failed-precondition') {
                console.warn('[TransitPay] Persistence: Multiple tabs open (OK)');
            } else if (persistErr.code === 'unimplemented') {
                console.warn('[TransitPay] Persistence: Not supported in this browser (OK)');
            } else {
                console.warn('[TransitPay] Persistence failed:', persistErr.message, '(continuing without it)');
            }
            // This is OK - we continue without persistence
        }

        // STEP 2: AWAIT anonymous auth - this is CRITICAL
        // Without waiting for auth, Firestore reads will fail if security rules require auth
        if (firebase.auth) {
            try {
                const authResult = await Promise.race([
                    firebase.auth().signInAnonymously(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Auth timeout')), 10000))
                ]);
                console.log('[TransitPay] Anonymous auth success ✅', authResult.user ? authResult.user.uid : '');
            } catch (authErr) {
                console.warn('[TransitPay] Anonymous auth failed:', authErr.message);
                // Continue anyway - some Firestore rules might allow unauthenticated access
            }
        }

        // STEP 3: Force network enablement
        if (typeof db.enableNetwork === 'function') {
            try {
                await db.enableNetwork();
                console.log('[TransitPay] Network enabled ✅');
            } catch (netErr) {
                console.warn('[TransitPay] enableNetwork failed:', netErr.message);
            }
        }

        // STEP 4: Verify connectivity with a quick test read
        let isOnline = false;
        try {
            const testSnap = await Promise.race([
                db.collection('config').doc('registry').get(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Connection test timeout')), 8000))
            ]);
            isOnline = true;
            console.log('[TransitPay] Firestore connectivity verified ✅ (doc exists:', testSnap.exists, ')');
        } catch (testErr) {
            console.warn('[TransitPay] Firestore connectivity test failed:', testErr.message);
            console.warn('[TransitPay] Will continue with firebaseReady=true but reads may use cache/fail');
        }

        window.firebaseReady = true;
        window._firebaseOnline = isOnline;
        console.log('[TransitPay] Firebase initialized ✅ (online:', isOnline, ')');

    } catch (err) {
        console.warn('[TransitPay] Firebase init failed, using localStorage fallback:', err);
        window.firebaseReady = false;
        window._firebaseOnline = false;
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
            new Promise((_, reject) => setTimeout(() => reject(new Error('Registry fetch timeout (10s)')), 10000))
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

        // If offline, try to force network
        if (err.message && err.message.toLowerCase().includes('offline')) {
            console.warn('[FS] Client appears offline. Attempting to force network...');
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
    if (!window.firebaseReady) {
        if (window._firebaseInitPromise) {
            await window._firebaseInitPromise;
        }
        if (!window.firebaseReady) return null;
    }
    try {
        const snap = await Promise.race([
            getTenantDocRef(tenantCode).get(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('AppData fetch timeout (10s)')), 10000))
        ]);
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
