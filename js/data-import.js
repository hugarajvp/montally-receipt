/* ============================
   TRANSITPAY - Data Import
   ============================ */


// ==================== DATA IMPORT ====================
let importedData = null;

// ==================== DATA CLEANUP ====================
// Fix misplaced petrol data that was accidentally saved as receipts
function fixMisplacedPetrolData() {
    if (!appData || !appData.receipts) return 0;

    const misplaced = [];
    const keep = [];

    appData.receipts.forEach(r => {
        // Detect misplaced petrol records:
        // - imported flag is true
        // - clientName is empty (petrol CSV doesn't have clientName)
        // - OR items[0].description contains petrol-like data
        const isEmpty = !r.clientName || r.clientName.trim() === '';
        const isImported = r.imported === true;
        const looksLikePetrol = r.items && r.items[0] && (
            r.items[0].description === 'Monthly transport - ' ||
            r.items[0].description === 'Trip: ' ||
            r.items[0].description === 'Monthly transport - undefined' ||
            r.items[0].description === 'Trip: undefined'
        );

        if (isImported && (isEmpty || looksLikePetrol)) {
            misplaced.push(r);
        } else {
            keep.push(r);
        }
    });

    if (misplaced.length === 0) return 0;

    console.log('[DataFix] Found', misplaced.length, 'misplaced petrol records in receipts. Moving to petrolExpenses...');

    // Move misplaced records to petrolExpenses
    if (!appData.petrolExpenses) appData.petrolExpenses = [];

    misplaced.forEach(r => {
        const expense = {
            id: 'PTR-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
            date: r.date,
            amount: r.total || 0,
            liters: 0,
            carPlate: '',
            notes: r.notes || 'Migrated from receipts',
            receipt: null,
            createdAt: r.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            imported: true
        };
        appData.petrolExpenses.push(expense);
    });

    // Remove misplaced records from receipts
    appData.receipts = keep;

    // Save the corrected data
    saveAppData(appData);

    console.log('[DataFix] Moved', misplaced.length, 'records to petrolExpenses ✅');
    console.log('[DataFix] Receipts remaining:', keep.length);
    console.log('[DataFix] Petrol expenses now:', appData.petrolExpenses.length);

    // Refresh UI
    if (typeof updateDashboard === 'function') updateDashboard();
    if (typeof loadReceipts === 'function') loadReceipts();
    if (typeof loadPetrolExpenses === 'function') loadPetrolExpenses();
    if (typeof updatePetrolDashboard === 'function') updatePetrolDashboard();

    if (typeof showToast === 'function') {
        showToast(`Fixed: Moved ${misplaced.length} petrol records from Receipts to Petrol section`, 'success');
    }

    return misplaced.length;
}

// Auto-run cleanup when page loads (after a small delay to ensure appData is ready)
setTimeout(() => {
    if (typeof appData !== 'undefined' && appData) {
        const fixed = fixMisplacedPetrolData();
        if (fixed > 0) {
            console.log('[DataFix] Auto-cleanup completed: fixed', fixed, 'misplaced records');
        }
    }
}, 3000);


function downloadSampleCSV() {
    const type = document.getElementById('importType').value;
    let csv, filename;
    if (type === 'receipts') {
        csv = 'date,clientName,clientPhone,clientAddress,type,amount,route,paymentStatus,notes\n';
        csv += '2025-01-15,Ahmad bin Ali,+60123456789,Jalan Sultan,monthly,500.00,KL to Shah Alam,Paid,January payment\n';
        csv += '2025-01-20,Siti Aminah,+60129876543,Taman Melawati,trip,35.00,Ampang to KLIA,Pending,Airport trip\n';
        filename = 'sample_receipts.csv';
    } else if (type === 'grocery') {
        csv = 'date,item,amount,payment\n';
        csv += '2025-01-10,Rice,25.50,Visa\n';
        csv += '2025-01-12,Chicken,18.90,Cash\n';
        csv += '2025-01-15,Vegetables,12.00,Aremex\n';
        filename = 'sample_grocery.csv';
    } else {
        csv = 'date,amount,liters,carPlate,notes\n';
        csv += '2025-01-10,120.00,38.5,BPE813,Full tank\n';
        csv += '2025-01-18,85.50,27.2,SMN1538,Half tank\n';
        filename = 'sample_petrol.csv';
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Sample CSV downloaded', 'success');
}

function handleImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
        showToast('Please upload a CSV file', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        const content = e.target.result;
        const type = document.getElementById('importType').value;
        importedData = parseCSV(content, type);

        if (importedData && importedData.length > 0) {
            showImportPreview(importedData, type);
            document.getElementById('confirmImportBtn').style.display = 'inline-flex';
        } else {
            showToast('No valid data found in CSV', 'error');
        }
    };
    reader.readAsText(file);
}

function parseCSV(csv, type) {
    const lines = csv.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length < 2) continue;

        const row = {};
        headers.forEach((h, idx) => {
            row[h] = values[idx] || '';
        });

        if (type === 'receipts') {
            data.push({
                date: row.date || '',
                clientName: row.clientName || '',
                clientPhone: row.clientPhone || '',
                clientAddress: row.clientAddress || '',
                type: row.type || 'monthly',
                amount: parseFloat(row.amount) || 0,
                route: row.route || '',
                paymentStatus: row.paymentStatus || row.paymentMethod || 'Paid',
                notes: row.notes || ''
            });
        } else if (type === 'grocery') {
            data.push({
                date: row.date || '',
                item: row.item || 'Grocery',
                amount: parseFloat(row.amount) || 0,
                payment: row.payment || 'Cash',
                notes: ''
            });
        } else {
            data.push({
                date: row.date || '',
                amount: parseFloat(row.amount) || 0,
                liters: parseFloat(row.liters) || 0,
                carPlate: row.carPlate || '',
                notes: row.notes || ''
            });
        }
    }

    return data;
}

function showImportPreview(data, type) {
    const preview = document.getElementById('importPreview');
    if (!preview) return;

    preview.style.display = 'block';

    const summaryHtml = `
        <div class="import-summary">
            <strong>${data.length}</strong> records found in CSV file. Review the preview below before importing.
        </div>
    `;

    let tableHtml;
    if (type === 'receipts') {
        tableHtml = `
            <table class="import-preview-table">
                <thead><tr><th>Date</th><th>Client</th><th>Type</th><th>Amount</th><th>Status</th><th>Route</th></tr></thead>
                <tbody>
                    ${data.slice(0, 10).map(r => `
                        <tr>
                            <td>${r.date}</td>
                            <td>${r.clientName}</td>
                            <td>${r.type}</td>
                            <td>RM ${r.amount.toFixed(2)}</td>
                            <td>${r.paymentStatus}</td>
                            <td>${r.route}</td>
                        </tr>
                    `).join('')}
                    ${data.length > 10 ? `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);">... and ${data.length - 10} more records</td></tr>` : ''}
                </tbody>
            </table>
        `;
    } else if (type === 'grocery') {
        tableHtml = `
            <table class="import-preview-table">
                <thead><tr><th>Date</th><th>Item</th><th>Amount</th><th>Payment</th></tr></thead>
                <tbody>
                    ${data.slice(0, 10).map(r => `
                        <tr>
                            <td>${r.date}</td>
                            <td>${r.item}</td>
                            <td>RM ${r.amount.toFixed(2)}</td>
                            <td>${r.payment}</td>
                        </tr>
                    `).join('')}
                    ${data.length > 10 ? `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);">... and ${data.length - 10} more records</td></tr>` : ''}
                </tbody>
            </table>
        `;
    } else {
        tableHtml = `
            <table class="import-preview-table">
                <thead><tr><th>Date</th><th>Amount</th><th>Notes</th></tr></thead>
                <tbody>
                    ${data.slice(0, 10).map(r => `
                        <tr>
                            <td>${r.date}</td>
                            <td>RM ${r.amount.toFixed(2)}</td>
                            <td>${r.notes}</td>
                        </tr>
                    `).join('')}
                    ${data.length > 10 ? `<tr><td colspan="3" style="text-align:center;color:var(--text-muted);">... and ${data.length - 10} more records</td></tr>` : ''}
                </tbody>
            </table>
        `;
    }

    preview.innerHTML = summaryHtml + tableHtml;
}

function confirmImport() {
    if (!importedData || importedData.length === 0) {
        showToast('No data to import', 'error');
        return;
    }

    const type = document.getElementById('importType').value;

    if (!confirm(`Are you sure you want to import ${importedData.length} ${type} records?`)) {
        return;
    }

    if (type === 'receipts') {
        importedData.forEach(row => {
            const receipt = {
                id: 'REC-' + appData.nextReceiptNumber++,
                date: row.date,
                clientName: row.clientName,
                clientPhone: row.clientPhone,
                clientAddress: row.clientAddress,
                type: row.type,
                paymentStatus: row.paymentStatus || 'Paid',
                total: row.amount,
                items: [{
                    description: row.type === 'monthly' ? 'Monthly transport - ' + row.route : 'Trip: ' + row.route,
                    amount: row.amount
                }],
                notes: row.notes,
                createdAt: new Date().toISOString(),
                imported: true
            };
            appData.receipts.push(receipt);
        });
    } else if (type === 'grocery') {
        if (!appData.groceries) appData.groceries = [];
        importedData.forEach(row => {
            appData.groceries.push({
                id: 'GRC-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
                date: row.date,
                item: row.item || 'Grocery',
                amount: row.amount,
                payment: row.payment || 'Cash',
                notes: '',
                createdAt: new Date().toISOString(),
                imported: true
            });
        });
    } else {
        importedData.forEach(row => {
            const expense = {
                id: 'PTR-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
                date: row.date,
                amount: row.amount,
                liters: row.liters,
                carPlate: row.carPlate,
                notes: row.notes,
                receipt: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                imported: true
            };
            appData.petrolExpenses.push(expense);
        });
    }

    if (typeof addAuditLog === 'function') addAuditLog('imported', 'import', `Imported ${importedData.length} ${type} records via CSV`, { count: importedData.length });
    saveAppData(appData);
    updateDashboard();

    if (type === 'receipts') {
        if (typeof loadReceipts === 'function') loadReceipts();
        if (typeof loadTrips === 'function') loadTrips();
        if (typeof loadClients === 'function') loadClients();
        if (typeof populateClientDropdown === 'function') populateClientDropdown();
    } else if (type === 'grocery') {
        if (typeof loadGroceries === 'function') loadGroceries();
    } else {
        if (typeof loadPetrolExpenses === 'function') loadPetrolExpenses();
        if (typeof updatePetrolDashboard === 'function') updatePetrolDashboard();
    }

    const importCount = importedData.length;
    importedData = null;
    document.getElementById('importPreview').style.display = 'none';
    document.getElementById('confirmImportBtn').style.display = 'none';
    document.getElementById('importFileInput').value = '';

    showToast(`Successfully imported ${importCount} ${type} records!`, 'success');
}