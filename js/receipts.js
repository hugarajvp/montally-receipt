/* ============================
   TRANSITPAY - Receipt Management
   ============================ */

// ==================== PAYMENT TYPE ====================
function selectPaymentType(type) {
    // Only monthly is supported; kept for backwards compatibility
    currentPaymentType = 'monthly';
    const monthlyBtn = document.getElementById('typeMonthly');
    if (monthlyBtn) monthlyBtn.classList.add('active');
    const monthlyFields = document.getElementById('monthlyFields');
    if (monthlyFields) monthlyFields.classList.add('active');
}

// ==================== TRIP MANAGEMENT ====================
let tripCount = 1;

function addTrip() {
    tripCount++;
    const tripsList = document.getElementById('tripsList');
    const today = new Date().toISOString().split('T')[0];

    const tripDiv = document.createElement('div');
    tripDiv.className = 'trip-entry';
    tripDiv.setAttribute('data-index', tripCount - 1);
    const locOptions = getLocationOptions();
    tripDiv.innerHTML = `
        <div class="trip-header">
            <span class="trip-number">Trip #${tripCount}</span>
            <button type="button" class="btn-remove-trip" onclick="removeTrip(this)">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
            </button>
        </div>
        <div class="form-grid trip-grid">
            <div class="form-group">
                <label>Trip Date</label>
                <input type="date" class="tripDate" value="${today}" required>
            </div>
            <div class="form-group">
                <label>From</label>
                <select class="tripFrom" required>
                    <option value="">-- Select --</option>
                    ${locOptions}
                </select>
            </div>
            <div class="form-group">
                <label>To</label>
                <select class="tripTo" required>
                    <option value="">-- Select --</option>
                    ${locOptions}
                </select>
            </div>
            <div class="form-group">
                <label>Amount (RM)</label>
                <input type="number" class="tripAmount" placeholder="0.00" step="0.01" min="0" required oninput="calculateTripTotal()">
            </div>
        </div>
    `;
    tripsList.appendChild(tripDiv);

    // Show remove buttons for all trips if more than 1
    updateRemoveButtons();
    calculateTripTotal();

    // Scroll to new trip
    tripDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function removeTrip(btn) {
    const tripEntry = btn.closest('.trip-entry');
    tripEntry.style.animation = 'fadeIn 0.2s ease reverse';
    setTimeout(() => {
        tripEntry.remove();
        renumberTrips();
        calculateTripTotal();
        updateRemoveButtons();
    }, 200);
}

function renumberTrips() {
    const entries = document.querySelectorAll('#tripsList .trip-entry');
    tripCount = entries.length;
    entries.forEach((entry, idx) => {
        entry.querySelector('.trip-number').textContent = `Trip #${idx + 1}`;
        entry.setAttribute('data-index', idx);
    });
}

function updateRemoveButtons() {
    const entries = document.querySelectorAll('#tripsList .trip-entry');
    entries.forEach(entry => {
        const btn = entry.querySelector('.btn-remove-trip');
        if (btn) {
            btn.style.display = entries.length > 1 ? 'flex' : 'none';
        }
    });
}

function calculateTripTotal() {
    const amounts = document.querySelectorAll('.tripAmount');
    let total = 0;
    amounts.forEach(a => {
        total += parseFloat(a.value) || 0;
    });
    const el = document.getElementById('tripTotalValue');
    if (el) el.textContent = 'RM ' + total.toFixed(2);
}

// ==================== RECEIPT GENERATION ====================
function generateReceipt(e) {
    e.preventDefault();

    const clientName = document.getElementById('clientName').value.trim();
    const clientPhone = document.getElementById('clientPhone').value.trim();
    const receiptDate = document.getElementById('receiptDate').value;
    // Read payment status from radio buttons
    const paymentStatusEl = document.querySelector('input[name="paymentStatus"]:checked');
    const paymentStatus = paymentStatusEl ? paymentStatusEl.value : 'Paid';

    if (!clientName || !receiptDate) {
        showToast('Please fill in all required fields', 'error');
        return false;
    }

    const receipt = {
        id: 'TPR-' + String(appData.nextReceiptNumber).padStart(5, '0'),
        type: 'monthly',
        clientName,
        clientPhone,
        date: receiptDate,
        paymentStatus,
        createdAt: new Date().toISOString(),
        items: [],
        total: 0
    };

    if (currentPaymentType === 'monthly') {
        const month = document.getElementById('monthlyMonth').value;
        const year = document.getElementById('monthlyYear').value;
        const amount = parseFloat(document.getElementById('monthlyAmount').value) || 0;

        if (!month || !year || amount <= 0) {
            showToast('Please fill in monthly payment details', 'error');
            return false;
        }

        receipt.items.push({
            description: `Monthly Transport — ${month} ${year}`,
            amount: amount
        });
        receipt.total = amount;
        receipt.month = month;
        receipt.year = parseInt(year);
    }

    // Save receipt
    appData.receipts.push(receipt);
    appData.nextReceiptNumber++;
    saveAppData(appData);

    // Refresh dashboard so grand total & charts update immediately
    updateDashboard();

    // Show receipt preview
    showReceiptPreview(receipt);

    // Reset form
    resetReceiptForm();
    showToast('Receipt generated successfully!', 'success');

    return false;
}


function resetReceiptForm() {
    document.getElementById('receiptForm').reset();
    const today = new Date();
    document.getElementById('receiptDate').value = today.toISOString().split('T')[0];
    document.getElementById('monthlyYear').value = today.getFullYear();
    currentPaymentType = 'monthly';
    // Reset payment status radio to Paid
    const paidRadio = document.getElementById('paymentStatus');
    if (paidRadio) paidRadio.checked = true;
}

function addDefaultTrip() {
    const today = new Date().toISOString().split('T')[0];
    const tripsList = document.getElementById('tripsList');
    const locOptions = getLocationOptions();
    tripsList.innerHTML = `
        <div class="trip-entry" data-index="0">
            <div class="trip-header">
                <span class="trip-number">Trip #1</span>
                <button type="button" class="btn-remove-trip" onclick="removeTrip(this)" style="display:none;">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                </button>
            </div>
            <div class="form-grid trip-grid">
                <div class="form-group">
                    <label>Trip Date</label>
                    <input type="date" class="tripDate" value="${today}" required>
                </div>
                <div class="form-group">
                    <label>From</label>
                    <select class="tripFrom" required>
                        <option value="">-- Select --</option>
                        ${locOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label>To</label>
                    <select class="tripTo" required>
                        <option value="">-- Select --</option>
                        ${locOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label>Amount (RM)</label>
                    <input type="number" class="tripAmount" placeholder="0.00" step="0.01" min="0" required oninput="calculateTripTotal()">
                </div>
            </div>
        </div>
    `;
}

// ==================== RECEIPT PREVIEW ====================
function showReceiptPreview(receipt) {
    const preview = document.getElementById('receiptPreview');

    // Determine status display
    const status = receipt.paymentStatus || 'Paid';
    const statusMap = {
        'Paid': { label: 'PAID', color: '#22c55e', rotate: '-5deg' },
        'Unpaid': { label: 'UNPAID', color: '#ef4444', rotate: '-5deg' },
        'Pending': { label: 'PENDING', color: '#f59e0b', rotate: '-3deg' },
        // Legacy support
        'Unable': { label: 'UNPAID', color: '#ef4444', rotate: '-5deg' }
    };
    const s = statusMap[status] || statusMap['Paid'];

    const itemsHtml = receipt.items.map(item => `
        <tr>
            <td>${item.description}</td>
            <td style="text-align:right;">RM ${item.amount.toFixed(2)}</td>
        </tr>
    `).join('');

    preview.innerHTML = `
        <div class="receipt-document" id="receiptDoc">
            <div class="receipt-top-bar"></div>
            <div class="receipt-body">
                <div class="receipt-company-row">
                    <div>
                        <div class="receipt-company-name">TransitPay</div>
                        <div class="receipt-company-tagline">Transport Services</div>
                    </div>
                    <div class="receipt-label-box">
                        <div class="label-receipt">RECEIPT</div>
                        <div class="receipt-no">${receipt.id}</div>
                    </div>
                </div>
                <div class="receipt-divider"></div>
                <div class="receipt-info-grid">
                    <div class="receipt-info-block">
                        <h4>Bill To</h4>
                        <p>
                            <strong>${receipt.clientName}</strong><br>
                            ${receipt.clientPhone ? receipt.clientPhone + '<br>' : ''}
                        </p>
                    </div>
                    <div class="receipt-info-block">
                        <h4>Receipt Details</h4>
                        <p>
                            <strong>Date:</strong> ${formatDate(receipt.date)}<br>
                            <strong>Type:</strong> Monthly Payment<br>
                            <strong>Status:</strong> ${status}
                        </p>
                    </div>
                </div>
                <table class="receipt-items-table">
                    <thead>
                        <tr>
                            <th>Description</th>
                            <th style="text-align:right;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>
                <div class="receipt-total-row">
                    <span class="receipt-total-label">TOTAL AMOUNT</span>
                    <span class="receipt-total-amount">RM ${receipt.total.toFixed(2)}</span>
                </div>
                <div class="receipt-footer-section">
                    <div class="receipt-payment-info">
                        <span><strong>Date Issued:</strong> ${formatDate(receipt.createdAt ? receipt.createdAt.split('T')[0] : receipt.date)}</span>
                    </div>
                    <div class="receipt-stamp">
                        <span class="paid-stamp" style="border-color:${s.color};color:${s.color};transform:rotate(${s.rotate});">${s.label}</span>
                    </div>
                </div>
                <div class="receipt-bottom-note">
                    Thank you for your business! This receipt was generated by TransitPay.
                </div>
            </div>
        </div>
    `;

    document.getElementById('receiptModal').classList.add('active');
}

function closeReceiptModal() {
    document.getElementById('receiptModal').classList.remove('active');
}

function printReceipt() {
    const receiptDoc = document.getElementById('receiptDoc');
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Receipt</title>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Inter', sans-serif; background: white; padding: 20px; }
                .receipt-document { max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
                .receipt-top-bar { height: 6px; background: linear-gradient(90deg, #6366f1, #8b5cf6, #a78bfa); }
                .receipt-body { padding: 2.5rem; }
                .receipt-company-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; }
                .receipt-company-name { font-size: 1.5rem; font-weight: 800; color: #6366f1; }
                .receipt-company-tagline { font-size: 0.8rem; color: #64748b; margin-top: 0.25rem; }
                .receipt-label-box { text-align: right; }
                .label-receipt { font-size: 1.75rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; color: #1a1a2e; }
                .receipt-no { font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; color: #6366f1; font-weight: 600; }
                .receipt-divider { height: 1px; background: linear-gradient(90deg, transparent, #e2e8f0, transparent); margin: 1.5rem 0; }
                .receipt-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem; }
                .receipt-info-block h4 { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #6366f1; margin-bottom: 0.5rem; }
                .receipt-info-block p { font-size: 0.9rem; color: #334155; line-height: 1.5; }
                .receipt-items-table { width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; }
                .receipt-items-table thead th { background: #f1f5f9; padding: 0.7rem 1rem; text-align: left; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #475569; border-bottom: 2px solid #e2e8f0; }
                .receipt-items-table thead th:last-child { text-align: right; }
                .receipt-items-table tbody td { padding: 0.7rem 1rem; font-size: 0.85rem; color: #334155; border-bottom: 1px solid #f1f5f9; }
                .receipt-items-table tbody td:last-child { text-align: right; font-family: 'JetBrains Mono', monospace; font-weight: 600; }
                .receipt-total-row { display: flex; justify-content: flex-end; align-items: center; gap: 2rem; padding: 1rem; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 8px; color: white; margin-bottom: 1.5rem; }
                .receipt-total-label { font-weight: 600; font-size: 0.9rem; }
                .receipt-total-amount { font-size: 1.5rem; font-weight: 900; font-family: 'JetBrains Mono', monospace; }
                .receipt-footer-section { display: flex; justify-content: space-between; align-items: flex-end; padding-top: 1rem; }
                .receipt-payment-info { font-size: 0.8rem; color: #64748b; }
                .receipt-payment-info span { display: block; margin-bottom: 0.25rem; }
                .receipt-payment-info strong { color: #334155; }
                .paid-stamp { display: inline-block; border: 3px solid #22c55e; color: #22c55e; font-weight: 900; font-size: 1.1rem; padding: 0.3rem 1.2rem; border-radius: 6px; transform: rotate(-5deg); letter-spacing: 0.1em; }
                .receipt-bottom-note { text-align: center; font-size: 0.7rem; color: #94a3b8; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid #e2e8f0; }
                @media print {
                    body { padding: 0; }
                    .receipt-document { border: none; }
                }
            </style>
        </head>
        <body>
            ${receiptDoc.outerHTML}
            <script>window.onload = function() { window.print(); }<\/script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// ==================== RECEIPTS LIST ====================
function loadReceipts() {
    const grid = document.getElementById('receiptsGrid');
    const filter = document.getElementById('receiptFilter').value;

    let receipts = [...appData.receipts].reverse();
    if (filter !== 'all') {
        receipts = receipts.filter(r => r.type === filter);
    }

    if (receipts.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1;">
                <div class="empty-icon">
                    <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                        <rect x="12" y="6" width="40" height="52" rx="4" stroke="currentColor" stroke-width="2" opacity="0.3"/>
                        <path d="M22 20h20M22 28h20M22 36h12" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.3"/>
                    </svg>
                </div>
                <h3>No Receipts Yet</h3>
                <p>Start by creating your first receipt</p>
                <button class="btn btn-primary" onclick="navigateTo('newReceipt')">Create Receipt</button>
            </div>
        `;
        return;
    }

    grid.innerHTML = receipts.map(r => {
        const status = r.paymentStatus || 'Paid';
        const statusBadge = {
            'Paid': '<span class="badge badge-paid">✅ PAID</span>',
            'Unpaid': '<span class="badge" style="background:rgba(239,68,68,0.1);color:#fca5a5;">❌ UNPAID</span>',
            'Pending': '<span class="badge" style="background:rgba(245,158,11,0.12);color:#fcd34d;">⏳ PENDING</span>',
            // Legacy
            'Unable': '<span class="badge" style="background:rgba(239,68,68,0.1);color:#fca5a5;">❌ UNPAID</span>'
        };
        return `
        <div class="receipt-card monthly" onclick='showReceiptPreview(${JSON.stringify(r).replace(/'/g, "&#39;")})'>
            <div class="receipt-card-header">
                <span class="receipt-card-number">${r.id}</span>
                <span class="badge badge-monthly">Monthly</span>
            </div>
            <div class="receipt-card-client">${r.clientName}</div>
            <div class="receipt-card-details">
                <span>${formatDate(r.date)}</span>
                <span>${r.items.length} item${r.items.length > 1 ? 's' : ''}</span>
            </div>
            <div class="receipt-card-amount">RM ${r.total.toFixed(2)}</div>
            <div class="receipt-card-footer">
                ${statusBadge[status] || statusBadge['Paid']}
                <span style="font-size:0.8rem;color:var(--text-muted);">${formatDate(r.date)}</span>
            </div>
        </div>
    `}).join('');
}

function filterReceipts() {
    loadReceipts();
}