/* ============================
   TRANSITPAY - Data Import
   ============================ */


// ==================== DATA IMPORT ====================
let importedData = null;

function downloadSampleCSV() {
    const type = document.getElementById('importType').value;
    let csv;
    if (type === 'receipts') {
        csv = 'date,clientName,clientPhone,clientAddress,type,amount,route,paymentMethod,notes\n';
        csv += '2025-01-15,Ahmad bin Ali,+60123456789,Jalan Sultan,monthly,500.00,Kuala Lumpur â†’ Shah Alam,Cash,January payment\n';
        csv += '2025-01-20,Siti Aminah,+60129876543,Taman Melawati,trip,35.00,Ampang â†’ KLIA,Bank Transfer,Airport trip\n';
    } else {
        csv = 'date,amount,liters,carPlate,notes\n';
        csv += '2025-01-10,120.00,38.5,BPE813,Full tank\n';
        csv += '2025-01-18,85.50,27.2,SMN1538,Half tank\n';
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = type === 'receipts' ? 'sample_receipts.csv' : 'sample_petrol.csv';
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
                paymentMethod: row.paymentMethod || 'Cash',
                notes: row.notes || ''
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
                <thead><tr><th>Date</th><th>Client</th><th>Type</th><th>Amount</th><th>Route</th></tr></thead>
                <tbody>
                    ${data.slice(0, 10).map(r => `
                        <tr>
                            <td>${r.date}</td>
                            <td>${r.clientName}</td>
                            <td>${r.type}</td>
                            <td>RM ${r.amount.toFixed(2)}</td>
                            <td>${r.route}</td>
                        </tr>
                    `).join('')}
                    ${data.length > 10 ? `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);">... and ${data.length - 10} more records</td></tr>` : ''}
                </tbody>
            </table>
        `;
    } else {
        tableHtml = `
            <table class="import-preview-table">
                <thead><tr><th>Date</th><th>Amount</th><th>Liters</th><th>Car Plate</th><th>Notes</th></tr></thead>
                <tbody>
                    ${data.slice(0, 10).map(r => `
                        <tr>
                            <td>${r.date}</td>
                            <td>RM ${r.amount.toFixed(2)}</td>
                            <td>${r.liters ? r.liters.toFixed(1) + 'L' : 'â€”'}</td>
                            <td>${r.carPlate}</td>
                            <td>${r.notes}</td>
                        </tr>
                    `).join('')}
                    ${data.length > 10 ? `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);">... and ${data.length - 10} more records</td></tr>` : ''}
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

    if (!confirm(`Are you sure you want to import ${importedData.length} ${type === 'receipts' ? 'receipt' : 'petrol expense'} records?`)) {
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
                paymentMethod: row.paymentMethod,
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

    saveAppData(appData);

    // Refresh dashboard so grand total & charts update immediately
    updateDashboard();

    // Reset UI
    importedData = null;
    document.getElementById('importPreview').style.display = 'none';
    document.getElementById('confirmImportBtn').style.display = 'none';
    document.getElementById('importFileInput').value = '';

    showToast(`Successfully imported ${type === 'receipts' ? 'receipt' : 'petrol expense'} data!`, 'success');
}