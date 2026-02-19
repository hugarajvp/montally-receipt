/* ============================
   TRANSITPAY - Dashboard
   ============================ */

// ==================== DASHBOARD ====================
function updateDashboard() {
    const period = document.getElementById('dashboardPeriod').value;
    const now = new Date();
    let startDate, endDate, prevStartDate, prevEndDate;

    if (period === 'thisMonth') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        prevStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        prevEndDate = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (period === 'lastMonth') {
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        prevStartDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        prevEndDate = new Date(now.getFullYear(), now.getMonth() - 1, 0);
    } else if (period === 'last3Months') {
        startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        prevStartDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        prevEndDate = new Date(now.getFullYear(), now.getMonth() - 2, 0);
    } else {
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31);
        prevStartDate = new Date(now.getFullYear() - 1, 0, 1);
        prevEndDate = new Date(now.getFullYear() - 1, 11, 31);
    }

    const currentReceipts = appData.receipts.filter(r => {
        const d = new Date(r.date);
        return d >= startDate && d <= endDate;
    });

    const prevReceipts = appData.receipts.filter(r => {
        const d = new Date(r.date);
        return d >= prevStartDate && d <= prevEndDate;
    });

    // Calculate stats
    const totalEarnings = currentReceipts.reduce((sum, r) => sum + r.total, 0);
    const prevEarnings = prevReceipts.reduce((sum, r) => sum + r.total, 0);

    const totalTrips = currentReceipts.filter(r => r.type === 'trip').reduce((sum, r) => sum + r.items.length, 0);
    const prevTrips = prevReceipts.filter(r => r.type === 'trip').reduce((sum, r) => sum + r.items.length, 0);

    const monthlyClients = new Set(currentReceipts.filter(r => r.type === 'monthly').map(r => r.clientName)).size;
    const prevMonthlyClients = new Set(prevReceipts.filter(r => r.type === 'monthly').map(r => r.clientName)).size;

    const receiptsCount = currentReceipts.length;
    const prevReceiptsCount = prevReceipts.length;

    // Update stat cards
    document.getElementById('totalEarningsVal').textContent = 'RM ' + totalEarnings.toFixed(2);
    document.getElementById('totalTripsVal').textContent = totalTrips;
    document.getElementById('monthlyClientsVal').textContent = monthlyClients;
    document.getElementById('receiptsGeneratedVal').textContent = receiptsCount;

    // Petrol spending for dashboard
    const petrolExpenses = appData.petrolExpenses || [];
    const currentPetrol = petrolExpenses.filter(p => {
        const d = new Date(p.date);
        return d >= startDate && d <= endDate;
    });
    const prevPetrol = petrolExpenses.filter(p => {
        const d = new Date(p.date);
        return d >= prevStartDate && d <= prevEndDate;
    });
    const petrolTotal = currentPetrol.reduce((s, p) => s + p.amount, 0);
    const prevPetrolTotal = prevPetrol.reduce((s, p) => s + p.amount, 0);
    document.getElementById('dashPetrolVal').textContent = 'RM ' + petrolTotal.toFixed(2);
    updateChangeIndicator('petrolChange', petrolTotal, prevPetrolTotal);

    // Update changes
    updateChangeIndicator('earningsChange', totalEarnings, prevEarnings);
    updateChangeIndicator('tripsChange', totalTrips, prevTrips);
    updateChangeIndicator('clientsChange', monthlyClients, prevMonthlyClients);
    updateChangeIndicator('receiptsChange', receiptsCount, prevReceiptsCount);

    // Update charts
    updateEarningsChart(period);
    updatePaymentChart(currentReceipts);

    // Update recent transactions
    updateRecentTable();
}

function updateChangeIndicator(elementId, current, previous) {
    const el = document.getElementById(elementId);
    if (previous === 0 && current > 0) {
        el.textContent = '+100%';
        el.className = 'stat-change positive';
    } else if (previous === 0) {
        el.textContent = '0%';
        el.className = 'stat-change positive';
    } else {
        const change = ((current - previous) / previous * 100).toFixed(0);
        el.textContent = (change >= 0 ? '+' : '') + change + '%';
        el.className = 'stat-change ' + (change >= 0 ? 'positive' : 'negative');
    }
}

function updateEarningsChart(period) {
    const ctx = document.getElementById('earningsChart').getContext('2d');

    if (earningsChartInstance) {
        earningsChartInstance.destroy();
    }

    const now = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let labels = [];
    let monthlyData = [];
    let tripData = [];

    let numMonths = period === 'thisYear' ? 12 : (period === 'last3Months' ? 3 : (period === 'lastMonth' ? 1 : 1));
    // Always show at least 6 months for a nicer chart
    numMonths = Math.max(numMonths, 6);

    for (let i = numMonths - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        labels.push(months[d.getMonth()] + ' ' + d.getFullYear());

        const mStart = new Date(d.getFullYear(), d.getMonth(), 1);
        const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);

        const monthReceipts = appData.receipts.filter(r => {
            const rd = new Date(r.date);
            return rd >= mStart && rd <= mEnd;
        });

        monthlyData.push(monthReceipts.filter(r => r.type === 'monthly').reduce((s, r) => s + r.total, 0));
        tripData.push(monthReceipts.filter(r => r.type === 'trip').reduce((s, r) => s + r.total, 0));
    }

    earningsChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Monthly',
                    data: monthlyData,
                    backgroundColor: 'rgba(99, 102, 241, 0.7)',
                    borderColor: '#6366f1',
                    borderWidth: 1,
                    borderRadius: 6,
                    borderSkipped: false,
                },
                {
                    label: 'Per-Trip',
                    data: tripData,
                    backgroundColor: 'rgba(6, 182, 212, 0.7)',
                    borderColor: '#06b6d4',
                    borderWidth: 1,
                    borderRadius: 6,
                    borderSkipped: false,
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#16163a',
                    titleColor: '#f1f5f9',
                    bodyColor: '#94a3b8',
                    borderColor: 'rgba(99,102,241,0.2)',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: ctx => ctx.dataset.label + ': RM ' + ctx.parsed.y.toFixed(2)
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(99,102,241,0.06)' },
                    ticks: { color: '#64748b', font: { size: 11 } }
                },
                y: {
                    grid: { color: 'rgba(99,102,241,0.06)' },
                    ticks: {
                        color: '#64748b',
                        font: { size: 11 },
                        callback: val => 'RM ' + val
                    }
                }
            }
        }
    });
}

function updatePaymentChart(receipts) {
    const ctx = document.getElementById('paymentChart').getContext('2d');

    if (paymentChartInstance) {
        paymentChartInstance.destroy();
    }

    const monthlyTotal = receipts.filter(r => r.type === 'monthly').reduce((s, r) => s + r.total, 0);
    const tripTotal = receipts.filter(r => r.type === 'trip').reduce((s, r) => s + r.total, 0);
    const grandTotal = monthlyTotal + tripTotal;

    document.querySelector('.donut-value').textContent = 'RM ' + grandTotal.toFixed(0);

    if (grandTotal === 0) {
        // Empty state for donut
        paymentChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['No Data'],
                datasets: [{
                    data: [1],
                    backgroundColor: ['rgba(99,102,241,0.1)'],
                    borderWidth: 0,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: { legend: { display: false }, tooltip: { enabled: false } }
            }
        });
        return;
    }

    paymentChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Monthly', 'Per-Trip'],
            datasets: [{
                data: [monthlyTotal, tripTotal],
                backgroundColor: ['rgba(99, 102, 241, 0.8)', 'rgba(6, 182, 212, 0.8)'],
                borderColor: ['#6366f1', '#06b6d4'],
                borderWidth: 2,
                hoverOffset: 8,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#94a3b8',
                        font: { size: 12 },
                        padding: 16,
                        usePointStyle: true,
                        pointStyleWidth: 10,
                    }
                },
                tooltip: {
                    backgroundColor: '#16163a',
                    titleColor: '#f1f5f9',
                    bodyColor: '#94a3b8',
                    borderColor: 'rgba(99,102,241,0.2)',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: ctx => ctx.label + ': RM ' + ctx.parsed.toFixed(2) + ' (' + ((ctx.parsed / grandTotal) * 100).toFixed(1) + '%)'
                    }
                }
            }
        }
    });
}

function updateRecentTable() {
    const tbody = document.getElementById('recentTableBody');
    const recent = [...appData.receipts].reverse().slice(0, 5);

    if (recent.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="6">
                    <div class="empty-state-mini">
                        <p>No transactions yet. Create your first receipt!</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = recent.map(r => `
        <tr onclick='showReceiptPreview(${JSON.stringify(r).replace(/'/g, "&#39;")})' style="cursor:pointer;">
            <td><span style="font-family:var(--font-mono);font-weight:600;color:var(--text-accent);">${r.id}</span></td>
            <td><strong>${r.clientName}</strong></td>
            <td><span class="badge ${r.type === 'monthly' ? 'badge-monthly' : 'badge-trip'}">${r.type === 'monthly' ? 'Monthly' : 'Trip'}</span></td>
            <td style="font-family:var(--font-mono);font-weight:600;">RM ${r.total.toFixed(2)}</td>
            <td>${formatDate(r.date)}</td>
            <td><span class="badge badge-paid">Paid</span></td>
        </tr>
    `).join('');
}