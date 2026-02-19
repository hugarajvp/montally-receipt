/* ============================
   TRANSITPAY - Petrol Expenses
   ============================ */

// ==================== LOCATION DROPDOWN MANAGEMENT ====================
function getLocationOptions() {
    const locations = appData.locations || [];
    return locations.map(loc => `<option value="${loc}">${loc}</option>`).join('');
}

function populateLocationDropdowns() {
    const locOptions = getLocationOptions();

    // Monthly route dropdown
    const monthlyRoute = document.getElementById('monthlyRoute');
    if (monthlyRoute) {
        const currentVal = monthlyRoute.value;
        let routeOptions = '<option value="">-- Select Route --</option>';
        const locations = appData.locations || [];
        // Create route combos from locations
        locations.forEach(from => {
            locations.forEach(to => {
                if (from !== to) {
                    const route = `${from} â†’ ${to}`;
                    routeOptions += `<option value="${route}">${route}</option>`;
                }
            });
        });
        monthlyRoute.innerHTML = routeOptions;
        if (currentVal) monthlyRoute.value = currentVal;
    }

    // Existing trip selects
    document.querySelectorAll('.tripFrom, .tripTo').forEach(sel => {
        const currentVal = sel.value;
        let html = '<option value="">-- Select --</option>' + locOptions;
        sel.innerHTML = html;
        if (currentVal) sel.value = currentVal;
    });
}

// ==================== PETROL EXPENSE MANAGEMENT ====================
let petrolFileData = null;
let petrolChartInstance = null;

function initPetrolDropZone() {
    const dropZone = document.getElementById('petrolDropZone');
    if (!dropZone) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(event => {
        dropZone.addEventListener(event, e => {
            e.preventDefault();
            e.stopPropagation();
        });
    });

    ['dragenter', 'dragover'].forEach(event => {
        dropZone.addEventListener(event, () => dropZone.classList.add('dragover'));
    });

    ['dragleave', 'drop'].forEach(event => {
        dropZone.addEventListener(event, () => dropZone.classList.remove('dragover'));
    });

    dropZone.addEventListener('drop', e => {
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            processFile(files[0]);
        }
    });
}

function handlePetrolFileSelect(event) {
    const file = event.target.files[0];
    if (file) processFile(file);
}

function processFile(file) {
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
        showToast('File too large. Maximum size is 5MB.', 'error');
        return;
    }

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(pdf|jpg|jpeg|png|webp|heic)$/i)) {
        showToast('Invalid file type. Please upload PDF, JPEG, PNG, or WebP.', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        petrolFileData = {
            name: file.name,
            type: file.type,
            size: file.size,
            data: e.target.result
        };
        showFilePreview();
    };
    reader.readAsDataURL(file);
}

function showFilePreview() {
    const uploadContent = document.querySelector('#petrolDropZone .file-upload-content');
    const previewDiv = document.getElementById('petrolFilePreview');

    uploadContent.style.display = 'none';
    previewDiv.style.display = 'flex';

    const isPdf = petrolFileData.type === 'application/pdf' || petrolFileData.name.endsWith('.pdf');
    const sizeKB = (petrolFileData.size / 1024).toFixed(1);

    previewDiv.innerHTML = `
        <div class="file-icon ${isPdf ? 'pdf' : 'img'}">${isPdf ? 'PDF' : 'IMG'}</div>
        <div class="file-info">
            <div class="file-name">${petrolFileData.name}</div>
            <div class="file-size">${sizeKB} KB</div>
        </div>
        <button type="button" class="file-remove" onclick="removePetrolFile()">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
        </button>
    `;
}

function removePetrolFile() {
    petrolFileData = null;
    const uploadContent = document.querySelector('#petrolDropZone .file-upload-content');
    const previewDiv = document.getElementById('petrolFilePreview');
    uploadContent.style.display = 'flex';
    previewDiv.style.display = 'none';
    previewDiv.innerHTML = '';
    document.getElementById('petrolFileInput').value = '';
}

function savePetrolExpense(e) {
    e.preventDefault();

    const date = document.getElementById('petrolDate').value;
    const amount = parseFloat(document.getElementById('petrolAmount').value) || 0;
    const liters = parseFloat(document.getElementById('petrolLiters').value) || 0;
    const carPlate = document.getElementById('petrolCarPlate').value;
    const notes = document.getElementById('petrolNotes').value.trim();
    const editingId = document.getElementById('editingPetrolId').value;

    if (!date || amount <= 0) {
        showToast('Date and amount are required', 'error');
        return false;
    }

    if (!carPlate) {
        showToast('Please select a car number plate', 'error');
        return false;
    }

    if (editingId) {
        const idx = appData.petrolExpenses.findIndex(p => p.id === editingId);
        if (idx !== -1) {
            appData.petrolExpenses[idx] = {
                ...appData.petrolExpenses[idx],
                date, amount, liters, carPlate, notes,
                receipt: petrolFileData || appData.petrolExpenses[idx].receipt,
                updatedAt: new Date().toISOString()
            };
            showToast('Petrol expense updated!', 'success');
        }
    } else {
        const expense = {
            id: 'PTR-' + Date.now(),
            date, amount, liters, carPlate, notes,
            receipt: petrolFileData || null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        appData.petrolExpenses.push(expense);
        showToast('Petrol expense logged!', 'success');
    }

    saveAppData(appData);
    clearPetrolForm();
    loadPetrolExpenses();
    updatePetrolDashboard();
    return false;
}

function clearPetrolForm() {
    document.getElementById('petrolForm').reset();
    document.getElementById('editingPetrolId').value = '';
    removePetrolFile();
    document.getElementById('savePetrolBtn').innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        Log Expense
    `;
}

function editPetrolExpense(expenseId) {
    const expense = appData.petrolExpenses.find(p => p.id === expenseId);
    if (!expense) return;

    document.getElementById('petrolDate').value = expense.date;
    document.getElementById('petrolAmount').value = expense.amount;
    document.getElementById('petrolLiters').value = expense.liters || '';
    document.getElementById('petrolCarPlate').value = expense.carPlate || expense.vehicle || '';
    document.getElementById('petrolNotes').value = expense.notes || '';
    document.getElementById('editingPetrolId').value = expense.id;

    if (expense.receipt) {
        petrolFileData = expense.receipt;
        showFilePreview();
    }

    document.getElementById('savePetrolBtn').innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 13l1.5-5L12 1l3 3-7.5 7.5L3 13z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
        </svg>
        Update Expense
    `;

    document.getElementById('petrolForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function deletePetrolExpense(expenseId) {
    if (!confirm('Delete this petrol expense?')) return;
    appData.petrolExpenses = appData.petrolExpenses.filter(p => p.id !== expenseId);
    saveAppData(appData);
    loadPetrolExpenses();
    updatePetrolDashboard();
    showToast('Petrol expense deleted', 'info');
}

function viewPetrolReceipt(expenseId) {
    const expense = appData.petrolExpenses.find(p => p.id === expenseId);
    if (!expense || !expense.receipt) return;

    const isPdf = expense.receipt.type === 'application/pdf' || expense.receipt.name.endsWith('.pdf');

    if (isPdf) {
        // Open PDF in new tab
        const pdfWindow = window.open('');
        pdfWindow.document.write(`
            <html><head><title>${expense.receipt.name}</title></head>
            <body style="margin:0;">
                <embed src="${expense.receipt.data}" type="application/pdf" width="100%" height="100%" style="position:fixed;top:0;left:0;width:100%;height:100%;"/>
            </body></html>
        `);
    } else {
        // Open image in new tab
        const imgWindow = window.open('');
        imgWindow.document.write(`
            <html><head><title>${expense.receipt.name}</title></head>
            <body style="margin:0;background:#111;display:flex;align-items:center;justify-content:center;min-height:100vh;">
                <img src="${expense.receipt.data}" style="max-width:100%;max-height:100vh;object-fit:contain;"/>
            </body></html>
        `);
    }
}

function loadPetrolExpenses() {
    const tbody = document.getElementById('petrolTableBody');
    const countEl = document.getElementById('petrolCount');
    const filterMonth = document.getElementById('petrolFilterMonth')?.value || 'all';

    let expenses = [...(appData.petrolExpenses || [])].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Populate filter months
    populatePetrolFilterMonths();

    // Apply month filter
    if (filterMonth !== 'all') {
        const [filtYear, filtMonth] = filterMonth.split('-').map(Number);
        expenses = expenses.filter(p => {
            const d = new Date(p.date);
            return d.getFullYear() === filtYear && d.getMonth() === filtMonth;
        });
    }

    countEl.textContent = expenses.length;

    if (expenses.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="6">
                    <div class="empty-state-mini">
                        <p>No petrol expenses${filterMonth !== 'all' ? ' for this period' : ''}.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = expenses.map(p => `
        <tr>
            <td>${formatDate(p.date)}</td>
            <td style="font-family:var(--font-mono);font-weight:600;">RM ${p.amount.toFixed(2)}</td>
            <td>${p.liters ? p.liters.toFixed(1) + 'L' : '<span style="color:var(--text-muted);">â€”</span>'}</td>
            <td><span style="font-family:var(--font-mono);font-weight:600;color:var(--text-accent);">${p.carPlate || p.vehicle || 'â€”'}</span></td>
            <td>${p.receipt ? '<button class="btn-view-file" onclick="viewPetrolReceipt(\'' + p.id + '\')">View</button>' : '<span style="color:var(--text-muted);">â€”</span>'}</td>
            <td>
                <div class="action-btn-group">
                    <button class="btn-action" onclick="editPetrolExpense('${p.id}')" title="Edit">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                            <path d="M3 13l1.5-5L12 1l3 3-7.5 7.5L3 13z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
                        </svg>
                    </button>
                    <button class="btn-action btn-action-danger" onclick="deletePetrolExpense('${p.id}')" title="Delete">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                            <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                        </svg>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function populatePetrolFilterMonths() {
    const select = document.getElementById('petrolFilterMonth');
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

// ==================== PETROL DASHBOARD ====================
function updatePetrolDashboard() {
    const expenses = appData.petrolExpenses || [];
    const now = new Date();

    // This month
    const thisMonthExpenses = expenses.filter(p => {
        const d = new Date(p.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const thisMonthTotal = thisMonthExpenses.reduce((s, p) => s + p.amount, 0);

    // All time total
    const totalSpent = expenses.reduce((s, p) => s + p.amount, 0);

    // Receipts with file
    const receiptCount = expenses.filter(p => p.receipt).length;

    // Average monthly (based on unique months with data)
    const monthSet = new Set(expenses.map(p => {
        const d = new Date(p.date);
        return `${d.getFullYear()}-${d.getMonth()}`;
    }));
    const avgMonthly = monthSet.size > 0 ? totalSpent / monthSet.size : 0;

    document.getElementById('petrolThisMonth').textContent = 'RM ' + thisMonthTotal.toFixed(2);
    document.getElementById('petrolTotalSpent').textContent = 'RM ' + totalSpent.toFixed(2);
    document.getElementById('petrolReceiptCount').textContent = receiptCount;
    document.getElementById('petrolAvgMonthly').textContent = 'RM ' + avgMonthly.toFixed(2);

    // Update chart
    updatePetrolChart();
}

function updatePetrolChart() {
    const ctx = document.getElementById('petrolChart');
    if (!ctx) return;

    if (petrolChartInstance) {
        petrolChartInstance.destroy();
    }

    const now = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const labels = [];
    const data = [];

    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        labels.push(monthNames[d.getMonth()] + ' ' + d.getFullYear());

        const mStart = new Date(d.getFullYear(), d.getMonth(), 1);
        const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);

        const monthTotal = (appData.petrolExpenses || []).filter(p => {
            const pd = new Date(p.date);
            return pd >= mStart && pd <= mEnd;
        }).reduce((s, p) => s + p.amount, 0);

        data.push(monthTotal);
    }

    petrolChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Petrol',
                data,
                backgroundColor: 'rgba(245, 158, 11, 0.6)',
                borderColor: '#f59e0b',
                borderWidth: 1,
                borderRadius: 6,
                borderSkipped: false,
            }]
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
                    borderColor: 'rgba(245,158,11,0.2)',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: ctx => 'Petrol: RM ' + ctx.parsed.y.toFixed(2)
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(245,158,11,0.06)' },
                    ticks: { color: '#64748b', font: { size: 11 } }
                },
                y: {
                    grid: { color: 'rgba(245,158,11,0.06)' },
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