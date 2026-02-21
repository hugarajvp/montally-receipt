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

    // 1. Wait for Firebase to be ready
    while (!window.firebaseReady && (Date.now() - start < 4000)) {
        await new Promise(r => setTimeout(r, 200));
    }

    // 2. Try fresh fetch
    if (window.firebaseReady && typeof getRegistryCloud === 'function') {
        try {
            console.log('[TransitPay] Attempting cloud registry fetch...');
            const cloudReg = await getRegistryCloud();
            if (cloudReg) {
                // If a specific tenant is required, check for it
                if (requiredTenantCode) {
                    const hasTenant = cloudReg.tenants && cloudReg.tenants.some(t => t.code.toUpperCase() === requiredTenantCode.toUpperCase());
                    if (hasTenant) {
                        console.log(`[TransitPay] Registry synced from cloud with tenant ${requiredTenantCode} ✅`);
                        return true;
                    }
                    // If not found yet, we continue to the polling loop
                } else {
                    console.log('[TransitPay] Registry synced from cloud ✅');
                    return true;
                }
            }
        } catch (err) {
            console.warn('[TransitPay] Cloud sync failed, falling back:', err);
        }
    }

    // 3. Polling loop
    return new Promise((resolve) => {
        let fetchRunning = false;
        const check = setInterval(async () => {
            const currentRegRaw = localStorage.getItem('transitpay_registry');
            let hasRequired = !requiredTenantCode;

            if (currentRegRaw && requiredTenantCode) {
                try {
                    const reg = JSON.parse(currentRegRaw);
                    hasRequired = reg.tenants && reg.tenants.some(t => {
                        const code = (t.code || '').toUpperCase();
                        return code === requiredTenantCode.toUpperCase();
                    });
                } catch (e) { }
            }

            // If we don't have what we need yet, and firebase is ready, and we aren't already fetching... retry!
            if (!hasRequired && window.firebaseReady && !fetchRunning && (Date.now() - start < timeoutMs - 1000)) {
                fetchRunning = true;
                console.log('[TransitPay] Retrying cloud registry sync...');
                getRegistryCloud().then(res => {
                    fetchRunning = false;
                    if (res) console.log('[TransitPay] Late sync success ✅');
                }).catch(() => {
                    fetchRunning = false;
                });
            }

            // Already synced or reached timeout
            if (window.registrySynced || hasRequired || (Date.now() - start > timeoutMs)) {
                clearInterval(check);
                console.log(`[TransitPay] Sync check complete. Has target ${requiredTenantCode}: ${hasRequired}`);
                resolve(!!currentRegRaw);
            }
        }, 1000); // Poll every 1s instead of 300ms since we might be doing network calls
    });
}
