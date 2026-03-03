/* ============================
   TRANSITPAY - Grocery Tracker
   Simple grocery tracking for mom 🛒
   ============================ */

// ==================== SAVE GROCERY ====================
function saveGrocery(e) {
    e.preventDefault();

    const date = document.getElementById('groceryDate').value;
    const item = document.getElementById('groceryItem').value.trim();
    const amount = parseFloat(document.getElementById('groceryAmount').value) || 0;
    const payment = document.querySelector('input[name="groceryPayment"]:checked')?.value || 'Cash';
    const notes = document.getElementById('groceryNotes').value.trim();

    if (!date || !item || amount <= 0) {
        showToast('Please fill in date, item and amount', 'error');
        return false;
    }

    if (!appData.groceries) appData.groceries = [];

    const entry = {
        id: 'GRC-' + Date.now(),
        date, item, amount, payment, notes,
        createdAt: new Date().toISOString()
    };

    appData.groceries.push(entry);
    saveAppData(appData);
    clearGroceryForm();
    loadGroceries();
    showToast('Grocery added ✅', 'success');
    return false;
}

function clearGroceryForm() {
    document.getElementById('groceryForm').reset();
    document.getElementById('groceryDate').value = new Date().toISOString().split('T')[0];
    // Reset to Cash default
    const cashRadio = document.getElementById('payVisa');
    if (cashRadio) cashRadio.checked = true;
}

function deleteGrocery(id) {
    if (!confirm('Delete this grocery entry?')) return;
    appData.groceries = (appData.groceries || []).filter(g => g.id !== id);
    saveAppData(appData);
    loadGroceries();
    showToast('Entry deleted', 'info');
}

// ==================== LOAD GROCERY LIST ====================
function loadGroceries() {
    const tbody = document.getElementById('groceryTableBody');
    const totalEl = document.getElementById('groceryTotal');
    const filterMonth = document.getElementById('groceryFilterMonth')?.value || 'all';

    // Ensure groceries array exists
    if (!appData.groceries) appData.groceries = [];

    let list = [...appData.groceries].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Filter by month
    if (filterMonth !== 'all') {
        const [fy, fm] = filterMonth.split('-').map(Number);
        list = list.filter(g => {
            const d = new Date(g.date);
            return d.getFullYear() === fy && d.getMonth() === fm;
        });
    }

    // Update total
    const total = list.reduce((s, g) => s + g.amount, 0);
    if (totalEl) totalEl.textContent = 'RM ' + total.toFixed(2);

    // Payment badge colours
    const payBadge = {
        'Visa': '<span style="background:rgba(99,102,241,0.15);color:#a5b4fc;padding:2px 8px;border-radius:99px;font-size:0.72rem;font-weight:700;">💳 VISA</span>',
        'Aremex': '<span style="background:rgba(245,158,11,0.15);color:#fcd34d;padding:2px 8px;border-radius:99px;font-size:0.72rem;font-weight:700;">🟡 AREMEX</span>',
        'Cash': '<span style="background:rgba(34,197,94,0.15);color:#4ade80;padding:2px 8px;border-radius:99px;font-size:0.72rem;font-weight:700;">💵 CASH</span>'
    };

    if (list.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="5">
                    <div class="empty-state-mini">
                        <p>No grocery entries${filterMonth !== 'all' ? ' for this period' : ''}. Add your first item above!</p>
                    </div>
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = list.map(g => `
        <tr>
            <td>${formatDate(g.date)}</td>
            <td><strong>${g.item}</strong>${g.notes ? '<br><span style="color:var(--text-muted);font-size:0.78rem;">' + g.notes + '</span>' : ''}</td>
            <td>${payBadge[g.payment] || payBadge['Cash']}</td>
            <td style="font-family:var(--font-mono);font-weight:700;color:var(--primary-300);">RM ${g.amount.toFixed(2)}</td>
            <td>
                <button class="btn-action btn-action-danger" onclick="deleteGrocery('${g.id}')" title="Delete">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                        <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                </button>
            </td>
        </tr>
    `).join('');

    // Populate month filter
    populateGroceryFilterMonths();
}

// ==================== FILTER MONTHS ====================
function populateGroceryFilterMonths() {
    const select = document.getElementById('groceryFilterMonth');
    if (!select) return;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const currentVal = select.value;
    let options = '<option value="all">All Months</option>';
    for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const val = `${d.getFullYear()}-${d.getMonth()}`;
        options += `<option value="${val}">${months[d.getMonth()]} ${d.getFullYear()}</option>`;
    }
    select.innerHTML = options;
    if (currentVal) select.value = currentVal;
}

// ==================== GROCERY REPORT (RECEIPT STYLE) ====================
function printGroceryReport() {
    const filterMonth = document.getElementById('groceryFilterMonth')?.value || 'all';
    let list = [...(appData.groceries || [])].sort((a, b) => new Date(a.date) - new Date(b.date));

    if (filterMonth !== 'all') {
        const [fy, fm] = filterMonth.split('-').map(Number);
        list = list.filter(g => {
            const d = new Date(g.date);
            return d.getFullYear() === fy && d.getMonth() === fm;
        });
    }

    if (list.length === 0) {
        showToast('No entries to print for the selected period.', 'error');
        return;
    }

    const total = list.reduce((s, g) => s + g.amount, 0);
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const now = new Date();
    let periodLabel = 'All Time';
    if (filterMonth !== 'all') {
        const [fy, fm] = filterMonth.split('-').map(Number);
        periodLabel = `${months[fm]} ${fy}`;
    }

    const visaTotal = list.filter(g => g.payment === 'Visa').reduce((s, g) => s + g.amount, 0);
    const aremexTotal = list.filter(g => g.payment === 'Aremex').reduce((s, g) => s + g.amount, 0);
    const cashTotal = list.filter(g => g.payment === 'Cash').reduce((s, g) => s + g.amount, 0);

    const itemsHtml = list.map((g, i) => `
        <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:0.6rem 0.75rem;font-size:0.82rem;color:#334155;">${i + 1}</td>
            <td style="padding:0.6rem 0.75rem;font-size:0.82rem;color:#334155;">${formatDate(g.date)}</td>
            <td style="padding:0.6rem 0.75rem;font-size:0.82rem;color:#334155;font-weight:600;">${g.item}</td>
            <td style="padding:0.6rem 0.75rem;font-size:0.72rem;color:#64748b;">${g.notes || '—'}</td>
            <td style="padding:0.6rem 0.75rem;font-size:0.8rem;color:#334155;">${g.payment}</td>
            <td style="padding:0.6rem 0.75rem;font-family:monospace;font-weight:700;color:#334155;text-align:right;">RM ${g.amount.toFixed(2)}</td>
        </tr>
    `).join('');

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Grocery Report — ${periodLabel}</title>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
            <style>
                * { margin:0; padding:0; box-sizing:border-box; }
                body { font-family:'Inter',sans-serif; background:white; padding:24px; }
                .doc { max-width:680px; margin:0 auto; border:1px solid #e2e8f0; border-radius:10px; overflow:hidden; }
                .top-bar { height:6px; background:linear-gradient(90deg,#6366f1,#8b5cf6,#a78bfa); }
                .body { padding:2.5rem; }
                .header-row { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:2rem; }
                .brand { font-size:1.5rem; font-weight:800; color:#6366f1; }
                .brand-sub { font-size:0.78rem; color:#64748b; margin-top:3px; }
                .title-box { text-align:right; }
                .title-box .title { font-size:1.6rem; font-weight:900; text-transform:uppercase; letter-spacing:0.08em; color:#1a1a2e; }
                .title-box .period { font-size:0.82rem; color:#6366f1; font-weight:600; margin-top:2px; }
                .divider { height:1px; background:linear-gradient(90deg,transparent,#e2e8f0,transparent); margin:1.5rem 0; }
                table { width:100%; border-collapse:collapse; margin-bottom:1.5rem; }
                thead th { background:#f8fafc; padding:0.6rem 0.75rem; text-align:left; font-size:0.68rem; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:#475569; border-bottom:2px solid #e2e8f0; }
                thead th:last-child { text-align:right; }
                .summary { display:flex; gap:1rem; justify-content:flex-end; margin-bottom:1.5rem; flex-wrap:wrap; }
                .summary-item { background:#f8fafc; border-radius:8px; padding:0.6rem 1rem; text-align:center; }
                .summary-item .label { font-size:0.65rem; font-weight:700; text-transform:uppercase; color:#64748b; letter-spacing:0.05em; }
                .summary-item .val { font-size:1rem; font-weight:800; font-family:monospace; color:#334155; margin-top:2px; }
                .total-row { display:flex; justify-content:space-between; align-items:center; background:linear-gradient(135deg,#6366f1,#8b5cf6); border-radius:8px; padding:1rem 1.5rem; color:white; margin-bottom:1.5rem; }
                .total-label { font-weight:600; font-size:0.9rem; }
                .total-amount { font-size:1.6rem; font-weight:900; font-family:monospace; }
                .footer { text-align:center; font-size:0.7rem; color:#94a3b8; padding-top:1rem; border-top:1px solid #e2e8f0; }
                @media print { body{padding:0;} .doc{border:none;border-radius:0;} }
            </style>
        </head>
        <body>
            <div class="doc">
                <div class="top-bar"></div>
                <div class="body">
                    <div class="header-row">
                        <div>
                            <div class="brand">🛒 Grocery Tracker</div>
                            <div class="brand-sub">Household Expense Record</div>
                        </div>
                        <div class="title-box">
                            <div class="title">REPORT</div>
                            <div class="period">${periodLabel}</div>
                        </div>
                    </div>
                    <div class="divider"></div>
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Date</th>
                                <th>Item</th>
                                <th>Notes</th>
                                <th>Payment</th>
                                <th style="text-align:right;">Amount</th>
                            </tr>
                        </thead>
                        <tbody>${itemsHtml}</tbody>
                    </table>
                    <div class="summary">
                        ${visaTotal > 0 ? `<div class="summary-item"><div class="label">💳 Visa</div><div class="val">RM ${visaTotal.toFixed(2)}</div></div>` : ''}
                        ${aremexTotal > 0 ? `<div class="summary-item"><div class="label">🟡 Aremex</div><div class="val">RM ${aremexTotal.toFixed(2)}</div></div>` : ''}
                        ${cashTotal > 0 ? `<div class="summary-item"><div class="label">💵 Cash</div><div class="val">RM ${cashTotal.toFixed(2)}</div></div>` : ''}
                    </div>
                    <div class="total-row">
                        <span class="total-label">TOTAL SPENT</span>
                        <span class="total-amount">RM ${total.toFixed(2)}</span>
                    </div>
                    <div class="footer">Printed on ${now.toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' })} • TransitPay Grocery Tracker</div>
                </div>
            </div>
            <script>window.onload = function() { window.print(); }<\/script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// ==================== INIT ====================
function initGrocery() {
    if (!appData.groceries) appData.groceries = [];
    document.getElementById('groceryDate').value = new Date().toISOString().split('T')[0];
    populateGroceryFilterMonths();
    loadGroceries();
}
