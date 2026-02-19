/* ============================
   TRANSITPAY - Email Invoicing
   ============================ */

// ==================== EMAIL INVOICING ====================
function populateInvoiceClients() {
    const select = document.getElementById('invoiceClient');
    if (!select) return;
    const clientsWithEmail = (appData.clients || []).filter(c => c.email);
    select.innerHTML = '<option value="all">All Clients with Email (' + clientsWithEmail.length + ')</option>' +
        clientsWithEmail.map(c => `<option value="${c.id}">${c.name} (${c.email})</option>`).join('');

    // Set current month
    const now = new Date();
    const monthSelect = document.getElementById('invoiceMonth');
    if (monthSelect) {
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        monthSelect.value = months[now.getMonth()];
    }
    const yearInput = document.getElementById('invoiceYear');
    if (yearInput) yearInput.value = now.getFullYear();
}

function previewInvoiceEmail() {
    const month = document.getElementById('invoiceMonth').value;
    const year = document.getElementById('invoiceYear').value;
    const subject = document.getElementById('invoiceSubject').value;
    const message = document.getElementById('invoiceMessage').value;
    const clientId = document.getElementById('invoiceClient').value;

    let sampleClient;
    if (clientId !== 'all') {
        sampleClient = appData.clients.find(c => c.id === clientId);
    } else {
        sampleClient = (appData.clients || []).find(c => c.email) || { name: 'Sample Client', email: 'sample@email.com', route: 'Sample Route', monthlyRate: 500 };
    }

    const previewMsg = message
        .replace(/{CLIENT_NAME}/g, sampleClient.name)
        .replace(/{MONTH}/g, month)
        .replace(/{YEAR}/g, year)
        .replace(/{AMOUNT}/g, (sampleClient.monthlyRate || 0).toFixed(2))
        .replace(/{ROUTE}/g, sampleClient.route || 'N/A');

    const reportContent = document.getElementById('reportPreviewModal');
    if (reportContent) {
        reportContent.style.display = 'flex';
        reportContent.querySelector('.modal-body').innerHTML = `
            <div class="email-preview-card">
                <div class="email-header">
                    <div class="email-field"><strong>To:</strong> ${sampleClient.email || 'N/A'}</div>
                    <div class="email-field"><strong>Subject:</strong> ${subject}</div>
                </div>
                <div class="email-body">${previewMsg}</div>
            </div>
        `;
    } else {
        alert('Preview:\n\nTo: ' + (sampleClient.email || 'N/A') + '\nSubject: ' + subject + '\n\n' + previewMsg);
    }
}

function sendInvoiceEmails() {
    const month = document.getElementById('invoiceMonth').value;
    const year = document.getElementById('invoiceYear').value;
    const subject = document.getElementById('invoiceSubject').value;
    const message = document.getElementById('invoiceMessage').value;
    const clientId = document.getElementById('invoiceClient').value;

    let clients;
    if (clientId === 'all') {
        clients = (appData.clients || []).filter(c => c.email);
    } else {
        const client = appData.clients.find(c => c.id === clientId);
        clients = client ? [client] : [];
    }

    if (clients.length === 0) {
        showToast('No clients with email addresses found', 'error');
        return;
    }

    let sentCount = 0;
    clients.forEach(client => {
        const emailBody = message
            .replace(/{CLIENT_NAME}/g, client.name)
            .replace(/{MONTH}/g, month)
            .replace(/{YEAR}/g, year)
            .replace(/{AMOUNT}/g, (client.monthlyRate || 0).toFixed(2))
            .replace(/{ROUTE}/g, client.route || 'N/A');

        // Open mailto link
        const mailtoLink = `mailto:${client.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;
        window.open(mailtoLink, '_blank');

        // Record in history
        if (!appData.emailHistory) appData.emailHistory = [];
        appData.emailHistory.push({
            id: 'INV-' + Date.now() + '-' + sentCount,
            dateSent: new Date().toISOString(),
            clientName: client.name,
            clientEmail: client.email,
            period: month + ' ' + year,
            amount: client.monthlyRate || 0,
            status: 'sent'
        });

        sentCount++;
    });

    saveAppData(appData);
    loadEmailHistory();
    showToast(`Invoice email(s) opened for ${sentCount} client(s)`, 'success');
}

function loadEmailHistory() {
    const tbody = document.getElementById('emailTableBody');
    const countEl = document.getElementById('emailCount');
    if (!tbody) return;

    const history = (appData.emailHistory || []).sort((a, b) => new Date(b.dateSent) - new Date(a.dateSent));
    if (countEl) countEl.textContent = history.length;

    if (history.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="6">
                    <div class="empty-state-mini">
                        <p>No invoices sent yet.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = history.map(h => `
        <tr>
            <td>${formatDate(h.dateSent.split('T')[0])}</td>
            <td><strong>${h.clientName}</strong></td>
            <td>${h.clientEmail}</td>
            <td>${h.period}</td>
            <td style="font-family:var(--font-mono);font-weight:600;">RM ${(h.amount || 0).toFixed(2)}</td>
            <td><span class="badge-${h.status}">${h.status.charAt(0).toUpperCase() + h.status.slice(1)}</span></td>
        </tr>
    `).join('');
}