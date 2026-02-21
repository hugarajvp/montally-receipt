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
    // Fallback if firebase-db.js didn't load or failed
    if (typeof window.firebaseReady !== 'undefined' && !window.firebaseReady && !localStorage.getItem('transitpay_registry')) {
        return false;
    }

    return new Promise((resolve) => {
        const start = Date.now();
        const check = setInterval(async () => {
            if (window.registrySynced) {
                clearInterval(check);
                resolve(true);
            } else if (Date.now() - start > timeoutMs) {
                clearInterval(check);
                // Try one last manual fetch via the cloud wrapper
                if (typeof getRegistryCloud === 'function') {
                    const reg = await getRegistryCloud();
                    resolve(!!reg);
                } else {
                    resolve(false);
                }
            }
        }, 200);
    });
}
