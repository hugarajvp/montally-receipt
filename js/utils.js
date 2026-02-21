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
async function waitForRegistrySync(timeoutMs = 5000) {
    console.log('[TransitPay] Waiting for registry sync...');

    // If firebase is ready, always try a fresh fetch first
    if (window.firebaseReady && typeof getRegistryCloud === 'function') {
        try {
            await getRegistryCloud();
            console.log('[TransitPay] Registry synced from cloud ✅');
            return true;
        } catch (err) {
            console.warn('[TransitPay] Cloud sync failed, falling back:', err);
        }
    }

    // Fallback/Wait logic
    return new Promise((resolve) => {
        const start = Date.now();
        const check = setInterval(async () => {
            // Already synced or reached timeout
            if (window.registrySynced || (Date.now() - start > timeoutMs)) {
                clearInterval(check);
                const currentReg = localStorage.getItem('transitpay_registry');
                console.log('[TransitPay] Sync check complete. Registry exists:', !!currentReg);
                resolve(!!currentReg);
            }
        }, 200);
    });
}
