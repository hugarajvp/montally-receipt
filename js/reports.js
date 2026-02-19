/* ============================
   TRANSITPAY - Reports
   ============================ */

// ==================== REPORTS ====================
function generateMonthlyReport() {
    const month = parseInt(document.getElementById('reportMonth').value);
    const year = parseInt(document.getElementById('reportYear').value);
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);

    const monthReceipts = appData.receipts.filter(r => {
        const d = new Date(r.date);
        return d >= startDate && d <= endDate;
    });

    const monthlyReceipts = monthReceipts.filter(r => r.type === 'monthly');
    const tripReceipts = monthReceipts.filter(r => r.type === 'trip');

    const totalEarnings = monthReceipts.reduce((s, r) => s + r.total, 0);
    const monthlyEarnings = monthlyReceipts.reduce((s, r) => s + r.total, 0);
    const tripEarnings = tripReceipts.reduce((s, r) => s + r.total, 0);
    const totalTrips = tripReceipts.reduce((s, r) => s + r.items.length, 0);
    const totalClients = new Set(monthReceipts.map(r => r.clientName)).size;

    // Petrol expenses for this month
    const monthPetrol = (appData.petrolExpenses || []).filter(p => {
        const d = new Date(p.date);
        return d >= startDate && d <= endDate;
    });
    const totalPetrol = monthPetrol.reduce((s, p) => s + p.amount, 0);

    const reportContent = document.getElementById('reportContent');
    reportContent.style.display = 'block';

    reportContent.innerHTML = `
        <h3 style="margin-bottom:0.5rem;">Report: ${months[month]} ${year}</h3>
        <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:1.5rem;">Generated on ${formatDate(new Date().toISOString().split('T')[0])}</p>
        
        <div class="report-summary-grid">
            <div class="report-summary-card">
                <span class="rs-label">Total Earnings</span>
                <span class="rs-value" style="color:var(--primary-400);">RM ${totalEarnings.toFixed(2)}</span>
            </div>
            <div class="report-summary-card">
                <span class="rs-label">Monthly Payments</span>
                <span class="rs-value" style="color:var(--primary-400);">RM ${monthlyEarnings.toFixed(2)}</span>
            </div>
            <div class="report-summary-card">
                <span class="rs-label">Trip Payments</span>
                <span class="rs-value" style="color:#22d3ee;">RM ${tripEarnings.toFixed(2)}</span>
            </div>
        </div>
        
        <div class="report-summary-grid">
            <div class="report-summary-card">
                <span class="rs-label">Total Receipts</span>
                <span class="rs-value">${monthReceipts.length}</span>
            </div>
            <div class="report-summary-card">
                <span class="rs-label">Total Trips</span>
                <span class="rs-value">${totalTrips}</span>
            </div>
            <div class="report-summary-card">
                <span class="rs-label">Unique Clients</span>
                <span class="rs-value">${totalClients}</span>
            </div>
            <div class="report-summary-card">
                <span class="rs-label">Petrol Expenses</span>
                <span class="rs-value" style="color:#f59e0b;">RM ${totalPetrol.toFixed(2)}</span>
            </div>
        </div>

        ${monthlyReceipts.length > 0 ? `
            <h4 class="report-section-title">Monthly Payment Receipts</h4>
            <div class="table-wrapper" style="margin-bottom:1.5rem;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Receipt #</th>
                            <th>Client</th>
                            <th>Description</th>
                            <th>Amount</th>
                            <th>Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${monthlyReceipts.map(r => `
                            <tr>
                                <td style="font-family:var(--font-mono);font-weight:600;color:var(--text-accent);">${r.id}</td>
                                <td><strong>${r.clientName}</strong></td>
                                <td>${r.items.map(i => i.description).join(', ')}</td>
                                <td style="font-family:var(--font-mono);font-weight:600;">RM ${r.total.toFixed(2)}</td>
                                <td>${formatDate(r.date)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        ` : '<p style="color:var(--text-muted);margin-bottom:1.5rem;">No monthly payment receipts for this period.</p>'}

        ${tripReceipts.length > 0 ? `
            <h4 class="report-section-title">Trip Payment Receipts</h4>
            <div class="table-wrapper" style="margin-bottom:1.5rem;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Receipt #</th>
                            <th>Client</th>
                            <th># Trips</th>
                            <th>Total Amount</th>
                            <th>Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tripReceipts.map(r => `
                            <tr>
                                <td style="font-family:var(--font-mono);font-weight:600;color:var(--text-accent);">${r.id}</td>
                                <td><strong>${r.clientName}</strong></td>
                                <td>${r.items.length}</td>
                                <td style="font-family:var(--font-mono);font-weight:600;">RM ${r.total.toFixed(2)}</td>
                                <td>${formatDate(r.date)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        ` : '<p style="color:var(--text-muted);margin-bottom:1.5rem;">No trip receipts for this period.</p>'}

        ${monthPetrol.length > 0 ? `
            <h4 class="report-section-title">Petrol Expenses</h4>
            <div class="table-wrapper" style="margin-bottom:1.5rem;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Car Plate</th>
                            <th>Liters</th>
                            <th>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${monthPetrol.map(p => `
                            <tr>
                                <td>${formatDate(p.date)}</td>
                                <td style="font-family:var(--font-mono);font-weight:600;">${p.carPlate || p.vehicle || 'â€”'}</td>
                                <td>${p.liters ? p.liters.toFixed(1) + 'L' : 'â€”'}</td>
                                <td style="font-family:var(--font-mono);font-weight:600;">RM ${p.amount.toFixed(2)}</td>
                            </tr>
                        `).join('')}
                        <tr style="font-weight:700;border-top:2px solid var(--border-color);">
                            <td colspan="3">Total Petrol</td>
                            <td style="font-family:var(--font-mono);font-weight:700;color:#f59e0b;">RM ${totalPetrol.toFixed(2)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        ` : '<p style="color:var(--text-muted);margin-bottom:1.5rem;">No petrol expenses for this period.</p>'}

        <div class="report-btn-row">
            <button class="btn btn-primary" onclick="printFullReport('${months[month]}', ${year})">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M4 6V1h8v5M4 12H2V7h12v5h-2" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
                    <rect x="4" y="10" width="8" height="5" rx="0.5" stroke="currentColor" stroke-width="1.2"/>
                </svg>
                Print Report
            </button>
        </div>
    `;

    reportContent.scrollIntoView({ behavior: 'smooth' });
    showToast('Report generated for ' + months[month] + ' ' + year, 'success');
}

function printFullReport(monthName, year) {
    const now = new Date();
    const month = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].indexOf(monthName);
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);

    const monthReceipts = appData.receipts.filter(r => {
        const d = new Date(r.date);
        return d >= startDate && d <= endDate;
    });

    const totalEarnings = monthReceipts.reduce((s, r) => s + r.total, 0);
    const monthlyEarnings = monthReceipts.filter(r => r.type === 'monthly').reduce((s, r) => s + r.total, 0);
    const tripEarnings = monthReceipts.filter(r => r.type === 'trip').reduce((s, r) => s + r.total, 0);

    // Petrol for this month
    const monthPetrol = (appData.petrolExpenses || []).filter(p => {
        const d = new Date(p.date);
        return d >= startDate && d <= endDate;
    });
    const totalPetrol = monthPetrol.reduce((s, p) => s + p.amount, 0);

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Monthly Report - ${monthName} ${year}</title>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Inter', sans-serif; background: white; color: #1a1a2e; padding: 40px; }
                .report-header { text-align: center; margin-bottom: 30px; }
                .report-header h1 { font-size: 1.5rem; color: #6366f1; }
                .report-header p { color: #64748b; font-size: 0.85rem; }
                .summary-row { display: flex; gap: 20px; margin-bottom: 30px; }
                .summary-box { flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; text-align: center; }
                .summary-box .label { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; }
                .summary-box .value { font-size: 1.3rem; font-weight: 800; margin-top: 5px; font-family: 'JetBrains Mono', monospace; }
                h3 { font-size: 1rem; color: #6366f1; margin: 20px 0 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                th { background: #f1f5f9; padding: 8px 12px; text-align: left; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; border-bottom: 2px solid #e2e8f0; }
                td { padding: 8px 12px; font-size: 0.85rem; color: #334155; border-bottom: 1px solid #f1f5f9; }
                .footer { text-align: center; margin-top: 40px; font-size: 0.7rem; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 15px; }
                .petrol-total { color: #f59e0b; }
            </style>
        </head>
        <body>
            <div class="report-header">
                <h1>TransitPay - Monthly Report</h1>
                <p>${monthName} ${year}</p>
            </div>
            <div class="summary-row">
                <div class="summary-box">
                    <div class="label">Total Earnings</div>
                    <div class="value">RM ${totalEarnings.toFixed(2)}</div>
                </div>
                <div class="summary-box">
                    <div class="label">Monthly</div>
                    <div class="value">RM ${monthlyEarnings.toFixed(2)}</div>
                </div>
                <div class="summary-box">
                    <div class="label">Trips</div>
                    <div class="value">RM ${tripEarnings.toFixed(2)}</div>
                </div>
                <div class="summary-box">
                    <div class="label">Petrol</div>
                    <div class="value petrol-total">RM ${totalPetrol.toFixed(2)}</div>
                </div>
                <div class="summary-box">
                    <div class="label">Receipts</div>
                    <div class="value">${monthReceipts.length}</div>
                </div>
            </div>
            <h3>All Receipts</h3>
            <table>
                <thead>
                    <tr>
                        <th>Receipt #</th>
                        <th>Client</th>
                        <th>Type</th>
                        <th>Items</th>
                        <th>Amount</th>
                        <th>Date</th>
                    </tr>
                </thead>
                <tbody>
                    ${monthReceipts.map(r => `
                        <tr>
                            <td style="font-family:'JetBrains Mono',monospace;font-weight:600;">${r.id}</td>
                            <td><strong>${r.clientName}</strong></td>
                            <td>${r.type === 'monthly' ? 'Monthly' : 'Trip'}</td>
                            <td>${r.items.length}</td>
                            <td style="font-family:'JetBrains Mono',monospace;font-weight:600;">RM ${r.total.toFixed(2)}</td>
                            <td>${formatDateSimple(r.date)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            ${monthPetrol.length > 0 ? `
                <h3>Petrol Expenses</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Car Plate</th>
                            <th>Liters</th>
                            <th>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${monthPetrol.map(p => `
                            <tr>
                                <td>${formatDateSimple(p.date)}</td>
                                <td style="font-family:'JetBrains Mono',monospace;font-weight:600;">${p.carPlate || p.vehicle || '\u2014'}</td>
                                <td>${p.liters ? p.liters.toFixed(1) + 'L' : '\u2014'}</td>
                                <td style="font-family:'JetBrains Mono',monospace;font-weight:600;">RM ${p.amount.toFixed(2)}</td>
                            </tr>
                        `).join('')}
                        <tr style="font-weight:700;">
                            <td colspan="3">Total Petrol</td>
                            <td style="font-family:'JetBrains Mono',monospace;font-weight:700;color:#f59e0b;">RM ${totalPetrol.toFixed(2)}</td>
                        </tr>
                    </tbody>
                </table>
            ` : ''}
            <div class="footer">
                Generated by TransitPay on ${formatDateSimple(new Date().toISOString().split('T')[0])}
            </div>
            <script>window.onload = function() { window.print(); }<\/script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

function closeReportModal() {
    document.getElementById('reportModal').classList.remove('active');
}

function printReport() {
    // Same logic as printFullReport with current selection
    const month = parseInt(document.getElementById('reportMonth').value);
    const year = parseInt(document.getElementById('reportYear').value);
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    printFullReport(months[month], year);
}