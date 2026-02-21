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
async function waitForRegistrySync(timeoutMs = 8000) {
    console.log('[TransitPay] Waiting for registry sync...');
    const start = Date.now();

    // 1. Wait for Firebase to be ready first (if it's intended to load)
    while (!window.firebaseReady && (Date.now() - start < 4000)) {
        await new Promise(r => setTimeout(r, 200));
    }

    // 2. If firebase is ready, always try a fresh fetch first
    if (window.firebaseReady && typeof getRegistryCloud === 'function') {
        try {
            console.log('[TransitPay] Attempting cloud registry fetch...');
            const cloudReg = await getRegistryCloud();
            if (cloudReg) {
                console.log('[TransitPay] Registry synced from cloud ✅');
                return true;
            }
        } catch (err) {
            console.warn('[TransitPay] Cloud sync failed, falling back:', err);
        }
    }

    // 3. Fallback/Wait logic for real-time sync listener (if any)
    return new Promise((resolve) => {
        const check = setInterval(async () => {
            const currentRegRaw = localStorage.getItem('transitpay_registry');
            let hasMaya = false;
            if (currentRegRaw) {
                try {
                    const reg = JSON.parse(currentRegRaw);
                    hasMaya = reg.tenants && reg.tenants.some(t => t.code === 'MAYA');
                } catch (e) { }
            }

            // Already synced or reached timeout
            if (window.registrySynced || hasMaya || (Date.now() - start > timeoutMs)) {
                clearInterval(check);
                console.log('[TransitPay] Sync check complete. Registry has Maya:', hasMaya);
                resolve(!!currentRegRaw);
            }
        }, 300);
    });
}
