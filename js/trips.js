/* ============================
   TRANSITPAY - Trip Management
   ============================ */

// ==================== TRIPS LIST ====================
function loadTrips() {
    const tbody = document.getElementById('tripsTableBody');
    const filterMonth = document.getElementById('tripFilterMonth').value;

    let allTrips = [];
    appData.receipts.filter(r => r.type === 'trip').forEach(r => {
        r.items.forEach(item => {
            allTrips.push({
                date: item.date || r.date,
                client: r.clientName,
                from: item.from || '-',
                to: item.to || '-',
                amount: item.amount,
                receiptId: r.id
            });
        });
    });

    // Sort by date descending
    allTrips.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Filter by month
    if (filterMonth !== 'all') {
        const [filtYear, filtMonth] = filterMonth.split('-').map(Number);
        allTrips = allTrips.filter(t => {
            const d = new Date(t.date);
            return d.getFullYear() === filtYear && d.getMonth() === filtMonth;
        });
    }

    if (allTrips.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="6">
                    <div class="empty-state-mini">
                        <p>No trips recorded${filterMonth !== 'all' ? ' for this period' : ''}.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = allTrips.map(t => `
        <tr>
            <td>${formatDate(t.date)}</td>
            <td><strong>${t.client}</strong></td>
            <td>${t.from}</td>
            <td>${t.to}</td>
            <td style="font-family:var(--font-mono);font-weight:600;">RM ${t.amount.toFixed(2)}</td>
            <td><span class="badge badge-trip">${t.receiptId}</span></td>
        </tr>
    `).join('');
}

function populateTripFilterMonths() {
    const select = document.getElementById('tripFilterMonth');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();

    let options = '<option value="all">All Months</option>';
    for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const val = `${d.getFullYear()}-${d.getMonth()}`;
        options += `<option value="${val}">${months[d.getMonth()]} ${d.getFullYear()}</option>`;
    }
    select.innerHTML = options;
}

function filterTrips() {
    loadTrips();
}