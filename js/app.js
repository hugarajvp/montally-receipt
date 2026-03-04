/* ============================
   TRANSITPAY - Core Application
   ============================ */

/* ============================
   TRANSITPAY - Application Logic
   ============================ */

// ==================== DATA STORE ====================
// Default storage key — overridden by tenant system
const STORAGE_KEY = 'transitpay_data';

function getActiveStorageKey() {
    return window._ACTIVE_STORAGE_KEY || STORAGE_KEY;
}

function getAppData() {
    const key = getActiveStorageKey();
    const data = localStorage.getItem(key);
    if (data) {
        const parsed = JSON.parse(data);
        // Ensure new fields exist for backwards compatibility
        if (!parsed.clients) parsed.clients = [];
        if (!parsed.users) parsed.users = [];
        if (!parsed.petrolExpenses) parsed.petrolExpenses = [];
        if (!parsed.locations) parsed.locations = [
            'Kuala Lumpur', 'Petaling Jaya', 'Shah Alam', 'Subang Jaya',
            'Putrajaya', 'Cyberjaya', 'Klang', 'Ampang', 'Cheras',
            'Kepong', 'Setapak', 'Wangsa Maju', 'Sri Hartamas',
            'Mont Kiara', 'Bangsar', 'KLIA', 'KLIA2'
        ];
        if (!parsed.carPlates) parsed.carPlates = ['BPE813', 'SMN1538'];
        if (!parsed.emailHistory) parsed.emailHistory = [];
        if (!parsed.auditLog) parsed.auditLog = [];
        return parsed;
    }
    return {
        user: null,
        receipts: [],
        clients: [],
        users: [],
        petrolExpenses: [],
        locations: [
            'Kuala Lumpur', 'Petaling Jaya', 'Shah Alam', 'Subang Jaya',
            'Putrajaya', 'Cyberjaya', 'Klang', 'Ampang', 'Cheras',
            'Kepong', 'Setapak', 'Wangsa Maju', 'Sri Hartamas',
            'Mont Kiara', 'Bangsar', 'KLIA', 'KLIA2'
        ],
        carPlates: ['BPE813', 'SMN1538'],
        emailHistory: [],
        auditLog: [],
        nextReceiptNumber: 1001
    };
}

function saveAppData(data) {
    // Save to localStorage immediately (fast, works offline)
    const key = getActiveStorageKey();
    localStorage.setItem(key, JSON.stringify(data));
    // Save to Firestore cloud in background
    if (typeof saveAppDataCloud === 'function') {
        saveAppDataCloud(data).then(() => {
            console.log('[AppData] Saved to cloud ✅');
        }).catch(err => {
            console.error('[AppData] Cloud save FAILED:', err.message);
            // Retry once after 3 seconds
            setTimeout(() => {
                saveAppDataCloud(data).then(() => {
                    console.log('[AppData] Retry succeeded ✅');
                }).catch(err2 => {
                    console.error('[AppData] Retry also failed:', err2.message);
                });
            }, 3000);
        });
    }
}

let appData = getAppData();
let currentPaymentType = 'monthly';
let earningsChartInstance = null;
let paymentChartInstance = null;

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
    // Set today's date as default
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const receiptDateEl = document.getElementById('receiptDate');
    if (receiptDateEl) receiptDateEl.value = todayStr;

    // Set today's date as default for petrol expense form
    const petrolDateEl = document.getElementById('petrolDate');
    if (petrolDateEl) petrolDateEl.value = todayStr;

    // Set default year
    const yearEl = document.getElementById('monthlyYear');
    if (yearEl) yearEl.value = today.getFullYear();

    // Set first trip date
    const firstTripDate = document.querySelector('.tripDate');
    if (firstTripDate) firstTripDate.value = todayStr;

    // Set report defaults
    const reportMonth = document.getElementById('reportMonth');
    const reportYear = document.getElementById('reportYear');
    if (reportMonth) reportMonth.value = today.getMonth();
    if (reportYear) reportYear.value = today.getFullYear();

    // Check for existing session (tenant-aware)
    // Session is stored in sessionStorage so it clears when the browser tab is closed,
    // requiring the user to log in again via the portal page.
    const savedSession = JSON.parse(sessionStorage.getItem('transitpay_session') || 'null');
    if (savedSession) {
        // Restore session — ensure we switch to the correct tenant scope first
        currentSession = savedSession;
        activateTenantScope(savedSession.tenantCode);
        showApp();
    }
    // NOTE: We intentionally do NOT fall back to appData.user alone.
    // If there is no sessionStorage session, the user must log in via the portal.

    // Populate trip filter months
    populateTripFilterMonths();

    // Populate client dropdown on receipt form
    populateClientDropdown();

    // Populate location dropdowns
    populateLocationDropdowns();

    // Populate car plates dropdown
    populateCarPlateDropdown();

    // Initialize petrol drag-and-drop
    initPetrolDropZone();
});

// ==================== AUTH ====================
function handleLogin(e) {
    e.preventDefault();
    const phone = document.getElementById('phoneInput').value.trim();
    const loginMode = document.getElementById('loginMode').value;

    if (!phone || phone.length < 6) {
        showToast('Please enter a valid phone number', 'error');
        return false;
    }

    let loginSuccess = false;

    if (loginMode === 'host') {
        loginSuccess = handleHostLogin(phone);
    } else {
        // Tenant login
        const tenantCode = document.getElementById('tenantCodeInput').value.trim().toUpperCase();
        if (!tenantCode) {
            showToast('Please enter your tenant code.', 'error');
            return false;
        }
        loginSuccess = handleTenantLogin(tenantCode, phone);
    }

    if (loginSuccess) {
        showApp();
        const welcomeName = currentSession ? currentSession.name : 'User';
        showToast(`Welcome, ${welcomeName}!`, 'success');
    }

    return false;
}

function handleLogout() {
    if (typeof addAuditLog === 'function') addAuditLog('logout', 'auth', `User logged out: ${appData.user ? (appData.user.name || 'Unknown') : 'Unknown'}`);
    appData.user = null;
    saveAppData(appData);

    // Stop real-time sync
    if (typeof stopRealtimeSync === 'function') stopRealtimeSync();

    // Clear session
    saveSession(null);
    window._ACTIVE_STORAGE_KEY = STORAGE_KEY;
    window._ACTIVE_TENANT_CODE = null;

    // Remove return-to-host banner if exists
    const banner = document.getElementById('returnToHostBanner');
    if (banner) banner.remove();

    // Remove tenant badge
    const badge = document.getElementById('tenantCodeBadge');
    if (badge) badge.remove();

    document.getElementById('mainApp').classList.remove('active');
    // Show portal login page
    const portalLogin = document.getElementById('portalLogin');
    if (portalLogin) {
        portalLogin.classList.add('active');
    }

    showToast('Logged out successfully', 'info');
}

function showApp() {
    // Hide portal login
    const portalLogin = document.getElementById('portalLogin');
    if (portalLogin) portalLogin.classList.remove('active');
    document.getElementById('mainApp').classList.add('active');

    // Update user info
    const phone = appData.user ? appData.user.phone : '';
    const userName = appData.user ? (appData.user.name || 'User') : 'User';
    const userRole = appData.user ? (appData.user.role || 'Administrator') : 'Administrator';
    document.getElementById('userPhone').textContent = phone;
    document.querySelector('.user-role').textContent = userRole;
    const initial = userName.charAt(0).toUpperCase();
    document.getElementById('userAvatar').textContent = initial;
    document.getElementById('mobileAvatar').textContent = initial;

    // Update menu visibility based on role
    updateMenuVisibility();

    // Log login event (do NOT saveAppData here — cloud data not loaded yet!)
    if (typeof addAuditLog === 'function') {
        // Queue the audit log write until AFTER cloud data is loaded
        window._pendingLoginLog = `User logged in: ${userName} (${userRole})`;
    }

    // CRITICAL: Fetch cloud data FIRST, then render dashboard
    const tenantCode = window._ACTIVE_TENANT_CODE || 'HOST';

    // Load cloud data with retry, then refresh all UI
    const loadAndRender = async () => {
        // STEP 1: Load from cloud with up to 3 retries (handles slow mobile connections)
        let cloudLoaded = false;
        const MAX_RETRIES = 3;
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            if (typeof activateTenantScopeCloud === 'function') {
                cloudLoaded = await activateTenantScopeCloud(tenantCode);
            }
            if (cloudLoaded) break;
            if (attempt < MAX_RETRIES) {
                console.warn(`[App] Cloud load attempt ${attempt} failed, retrying in 3s...`);
                await new Promise(r => setTimeout(r, 3000));
                // Also re-try Firebase init if it wasn't ready
                if (!window.firebaseReady && window._firebaseInitPromise) {
                    await window._firebaseInitPromise;
                }
            }
        }

        if (cloudLoaded) {
            console.log('[App] ✅ Cloud data loaded for', tenantCode,
                '| receipts:', appData.receipts ? appData.receipts.length : 0,
                '| clients:', appData.clients ? appData.clients.length : 0);
            showToast('✅ Data synced from cloud!', 'success');
        } else {
            console.warn('[App] ⚠️ All cloud load attempts failed. Using local cache.');
            // Only show warning if local cache is also empty
            const hasLocalData = appData.receipts && appData.receipts.length > 0;
            if (!hasLocalData) {
                showToast('⚠️ Could not load data. Check your connection.', 'warning');
            }
        }

        // STEP 2: Write login audit log after cloud data is in appData
        if (window._pendingLoginLog && typeof addAuditLog === 'function') {
            addAuditLog('login', 'auth', window._pendingLoginLog);
            window._pendingLoginLog = null;
        }

        // STEP 3: Start real-time listener for live updates across all PCs
        if (typeof startRealtimeSync === 'function') {
            startRealtimeSync(tenantCode);
        }

        // STEP 4: Refresh ALL UI sections with the correct cloud data
        updateDashboard();
        loadReceipts();
        loadTrips();
        loadClients();
        loadUsers();
        loadPetrolExpenses();
        populateClientDropdown();
        populateLocationDropdowns();
    };

    // Render immediately with local/cached data first (fast display)
    updateDashboard();
    loadReceipts();
    loadTrips();
    loadClients();
    loadUsers();
    loadPetrolExpenses();
    populateClientDropdown();
    populateLocationDropdowns();

    // Then fetch cloud data in background and re-render
    loadAndRender().catch(err => {
        console.warn('[App] Cloud data load error:', err.message);
    });
}

// ==================== NAVIGATION ====================
function navigateTo(page) {
    // Update sidebar
    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
    const menuItem = document.querySelector(`.menu-item[data-page="${page}"]`);
    if (menuItem) menuItem.classList.add('active');

    // Update content
    document.querySelectorAll('.content-section').forEach(el => el.classList.remove('active'));
    const section = document.getElementById(page + 'Section');
    if (section) section.classList.add('active');

    // Close mobile sidebar
    closeSidebar();

    // Refresh data on navigate
    if (page === 'dashboard') updateDashboard();
    if (page === 'receipts') loadReceipts();
    if (page === 'trips') loadTrips();
    if (page === 'clients') loadClients();
    if (page === 'users') {
        loadUsers();
    }
    if (page === 'petrol') {
        loadPetrolExpenses();
        updatePetrolDashboard();
        populateCarPlateDropdown();
        // Ensure petrol date defaults to today if not already set
        const petrolDateEl = document.getElementById('petrolDate');
        if (petrolDateEl && !petrolDateEl.value) {
            petrolDateEl.value = new Date().toISOString().split('T')[0];
        }
    }
    if (page === 'newReceipt') { populateClientDropdown(); populateLocationDropdowns(); }
    if (page === 'email') { populateInvoiceClients(); loadEmailHistory(); }
    if (page === 'settings') { renderLocationTags(); renderCarPlateTags(); }
    if (page === 'tenants') { loadTenants(); }
    if (page === 'auditLog') { loadAuditLog(); }
    if (page === 'monthlyBilling') { if (typeof initMonthlyBilling === 'function') initMonthlyBilling(); }
    if (page === 'grocery') { if (typeof initGrocery === 'function') initGrocery(); }

    // Sync mobile bottom nav
    const NAV_MAP = {
        dashboard: 'mnavDashboard', receipts: 'mnavReceipts',
        newReceipt: 'mnavNewReceipt', clients: 'mnavClients'
    };
    setMobileNavActive(NAV_MAP[page] || 'mnavMore');
}

function setMobileNavActive(btnId) {
    document.querySelectorAll('.mobile-nav-btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(btnId);
    if (btn) btn.classList.add('active');
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('active');

    // Add overlay
    let overlay = document.querySelector('.sidebar-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        overlay.onclick = closeSidebar;
        document.body.appendChild(overlay);
    }
    overlay.classList.toggle('active', sidebar.classList.contains('active'));
}


function closeSidebar() {
    document.getElementById('sidebar').classList.remove('active');
    const overlay = document.querySelector('.sidebar-overlay');
    if (overlay) overlay.classList.remove('active');
}



// ==================== UTILITIES ====================
function formatDate(dateStr) {
    if (!dateStr) return '-';
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateStr).toLocaleDateString('en-US', options);
}

function formatDateSimple(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M5 9L8 12L13 6" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9" cy="9" r="7.5" stroke="#22c55e" stroke-width="1.5"/></svg>',
        error: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M6 6L12 12M12 6L6 12" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/><circle cx="9" cy="9" r="7.5" stroke="#ef4444" stroke-width="1.5"/></svg>',
        warning: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 3L16 15H2L9 3z" stroke="#f59e0b" stroke-width="1.5" stroke-linejoin="round"/><path d="M9 8v3M9 13h.01" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"/></svg>',
        info: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="7.5" stroke="#0ea5e9" stroke-width="1.5"/><path d="M9 8v4M9 6h.01" stroke="#0ea5e9" stroke-width="2" stroke-linecap="round"/></svg>'
    };

    toast.innerHTML = `${icons[type] || icons.info}<span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'toastOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// Close modals on escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeReceiptModal();
        closeReportModal();
    }
});

// Close modals on overlay click
document.getElementById('receiptModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('receiptModal')) closeReceiptModal();
});
document.getElementById('reportModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('reportModal')) closeReportModal();
});
