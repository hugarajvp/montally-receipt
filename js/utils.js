/* ============================
   TRANSITPAY - Utility Functions
   ============================ */

/**
 * Normalizes a phone number to E.164-like format starting with +
 * Specifically handles Malaysian numbers (01... -> +601...)
 */
function normalizePhone(phone) {
    if (!phone) return '';
    let cleaned = phone.trim().replace(/[^\d+]/g, ''); // Remove non-digit chars except +
    cleaned = cleaned.replace(/^\+/, ''); // Remove leading + for processing

    // Malaysian mobile logic: 01... -> 601...
    if (cleaned.startsWith('0')) {
        cleaned = '60' + cleaned.substring(1);
    }

    // If it starts with 1... and is 9-10 digits, it's likely Malaysian without 60 or 0
    if (cleaned.startsWith('1') && (cleaned.length === 9 || cleaned.length === 10)) {
        cleaned = '60' + cleaned;
    }

    return '+' + cleaned;
}

/**
 * Waits for the Firebase registry to be synced to localStorage
 * Used during login to ensure the latest tenant list is available
 */
async function waitForRegistrySync(timeoutMs = 8000, requiredTenantCode = null) {
    console.log('[TransitPay] Waiting for registry sync...');
    const start = Date.now();

    // Reset cloud sync flag for this wait session
    window.registrySyncedCloud = false;

    // 1. Wait for Firebase to be ready
    while (!window.firebaseReady && (Date.now() - start < 4000)) {
        await new Promise(r => setTimeout(r, 200));
    }

    // 2. Try fresh fetch
    if (window.firebaseReady && typeof getRegistryCloud === 'function') {
        try {
            console.log('[TransitPay] Attempting cloud registry fetch...');
            await getRegistryCloud(); // This updates window.registrySyncedCloud inside fsGetRegistry

            if (window.registrySyncedCloud) {
                const cloudRegRaw = localStorage.getItem('transitpay_registry');
                if (cloudRegRaw) {
                    const cloudReg = JSON.parse(cloudRegRaw);
                    // If a specific tenant is required, check for it
                    if (requiredTenantCode) {
                        const hasTenant = cloudReg.tenants && cloudReg.tenants.some(t => t.code.toUpperCase() === requiredTenantCode.toUpperCase());
                        if (hasTenant) {
                            console.log(`[TransitPay] Primary sync: Tenant ${requiredTenantCode} found in cloud registry ✅`);
                            return true;
                        }
                    } else {
                        console.log('[TransitPay] Primary sync: Registry received from cloud ✅');
                        return true;
                    }
                }
            }
        } catch (err) {
            console.warn('[TransitPay] Primary cloud sync failed, will retry in background:', err);
        }
    }

    // 3. Polling loop / Retries
    return new Promise((resolve) => {
        let fetchRunning = false;
        const check = setInterval(async () => {
            const currentRegRaw = localStorage.getItem('transitpay_registry');
            let hasRequiredInCache = !requiredTenantCode;

            if (currentRegRaw && requiredTenantCode) {
                try {
                    const reg = JSON.parse(currentRegRaw);
                    hasRequiredInCache = reg.tenants && reg.tenants.some(t => {
                        const code = (t.code || '').toUpperCase();
                        return code === requiredTenantCode.toUpperCase();
                    });
                } catch (e) { }
            }

            // SUCCESS CONDITIONS
            // We succeed if:
            // a) We just got a FRESH cloud sync with the target
            // b) We ALREADY had the target in cache (from previous session)
            if (window.registrySyncedCloud || hasRequiredInCache) {
                clearInterval(check);
                const source = window.registrySyncedCloud ? 'CLOUD' : 'CACHE';
                console.log(`[TransitPay] Sync complete (via ${source}). Found ${requiredTenantCode || 'registry'}: true ✅`);
                resolve(true);
                return;
            }

            // RETRY LOGIC: If we don't have it yet, and firebase is ready, retry the fetch
            if (window.firebaseReady && !fetchRunning && (Date.now() - start < timeoutMs - 1000)) {
                fetchRunning = true;
                console.log('[TransitPay] Target not in cache. Retrying cloud fetch...');
                if (typeof getRegistryCloud === 'function') {
                    getRegistryCloud().then(() => {
                        fetchRunning = false;
                        if (window.registrySyncedCloud) console.log('[TransitPay] Late cloud sync success ✅');
                    }).catch(() => {
                        fetchRunning = false;
                    });
                } else {
                    fetchRunning = false;
                }
            }

            // TIMEOUT CONDITION
            if (Date.now() - start > timeoutMs) {
                clearInterval(check);
                console.warn(`[TransitPay] Sync timeout after ${timeoutMs}ms. Required ${requiredTenantCode}: false`);
                resolve(!!currentRegRaw); // Resolve with whatever we have in cache
            }
        }, 1000);
    });
}
