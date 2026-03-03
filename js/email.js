/* ============================
   TRANSITPAY - WhatsApp Invoicing
   (email stubs kept for backward compat)
   ============================ */

// ============================================================
//  WHATSAPP HELPERS
// ============================================================

function buildWhatsAppMessage(client, month, year) {
    const amount = (client.monthlyRate || 0).toFixed(2);
    return `Hi ${client.name} 👋,

This is a friendly reminder that your *transport payment* for *${month} ${year}* is due.

💰 *Amount:* RM ${amount}
📅 *Period:* ${month} ${year}
🚌 *Route:* ${client.route || 'N/A'}

Please make your payment at your earliest convenience. Thank you! 🙏

— TransitPay`;
}

function formatPhone(phone) {
    let p = (phone || '').replace(/[\s\-\(\)]/g, '');
    if (p.startsWith('0')) p = '60' + p.slice(1);
    p = p.replace(/^\+/, '');
    return p;
}

// ============================================================
//  POPULATE CLIENT DROPDOWN
// ============================================================
function populateInvoiceClients() {
    const waSelect = document.getElementById('waClient');
    if (waSelect) {
        const clients = appData.clients || [];
        waSelect.innerHTML = '<option value="">-- Select Client --</option>' +
            clients.map(c => `<option value="${c.id}">${c.name}${c.phone ? ' (+' + c.phone + ')' : ''}</option>`).join('');
    }

    const now = new Date();
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const setMonth = (id) => { const el = document.getElementById(id); if (el) el.value = months[now.getMonth()]; };
    const setYear = (id) => { const el = document.getElementById(id); if (el) el.value = now.getFullYear(); };
    setMonth('waMonth'); setYear('waYear');
    setMonth('waBulkMonth'); setYear('waBulkYear');

    // Old email stubs
    const invoiceClient = document.getElementById('invoiceClient');
    if (invoiceClient) {
        const clientsWithEmail = (appData.clients || []).filter(c => c.email);
        invoiceClient.innerHTML = '<option value="all">All Clients with Email (' + clientsWithEmail.length + ')</option>' +
            clientsWithEmail.map(c => `<option value="${c.id}">${c.name} (${c.email})</option>`).join('');
    }
    const monthSelect = document.getElementById('invoiceMonth');
    if (monthSelect) monthSelect.value = months[now.getMonth()];
    const yearInput = document.getElementById('invoiceYear');
    if (yearInput) yearInput.value = now.getFullYear();
}

// ============================================================
//  PREVIEW MESSAGE
// ============================================================
function updateWaPreview() {
    const clientId = document.getElementById('waClient')?.value;
    const month = document.getElementById('waMonth')?.value;
    const year = document.getElementById('waYear')?.value;
    const preview = document.getElementById('waMessagePreview');
    if (!preview) return;

    if (!clientId) { preview.value = ''; return; }

    const client = (appData.clients || []).find(c => c.id === clientId);
    if (!client) return;

    preview.value = buildWhatsAppMessage(client, month, year);
}

// ============================================================
//  SINGLE CLIENT — OPEN WHATSAPP
// ============================================================
function sendWhatsApp() {
    const clientId = document.getElementById('waClient')?.value;
    const month = document.getElementById('waMonth')?.value;
    const year = document.getElementById('waYear')?.value;

    if (!clientId) { showToast('Please select a client', 'error'); return; }

    const client = (appData.clients || []).find(c => c.id === clientId);
    if (!client) { showToast('Client not found', 'error'); return; }
    if (!client.phone) { showToast(`${client.name} has no phone number saved`, 'error'); return; }

    const msg = buildWhatsAppMessage(client, month, year);
    const phone = formatPhone(client.phone);
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');

    showToast(`Opening WhatsApp for ${client.name} ✅`, 'success');
}

// ============================================================
//  BULK — ALL UNPAID CLIENTS
// ============================================================
function sendBulkWhatsApp() {
    const month = document.getElementById('waBulkMonth')?.value;
    const year = document.getElementById('waBulkYear')?.value;
    const resultEl = document.getElementById('waBulkResult');

    const unpaid = (appData.receipts || []).filter(r =>
        (r.paymentStatus === 'Pending' || r.paymentStatus === 'Unpaid') &&
        r.month === month && String(r.year) === String(year)
    );

    if (unpaid.length === 0) {
        showToast(`No pending/unpaid receipts for ${month} ${year}`, 'error');
        return;
    }

    let opened = 0;
    const results = [];

    unpaid.forEach((r, i) => {
        const client = (appData.clients || []).find(c => c.name === r.clientName || c.id === r.clientId);
        const phone = client?.phone || r.clientPhone;

        if (!phone) {
            results.push(`⚠️ <strong>${r.clientName}</strong> — no phone number`);
            return;
        }

        const msg = buildWhatsAppMessage(
            { name: r.clientName, monthlyRate: r.total, route: client?.route || 'N/A' },
            month, year
        );
        const url = `https://wa.me/${formatPhone(phone)}?text=${encodeURIComponent(msg)}`;

        setTimeout(() => window.open(url, '_blank'), i * 800);
        results.push(`✅ <strong>${r.clientName}</strong> — RM ${r.total.toFixed(2)}`);
        opened++;
    });

    if (resultEl) {
        resultEl.innerHTML = `
            <div style="background:rgba(37,211,102,0.08);border:1px solid rgba(37,211,102,0.2);border-radius:8px;padding:1rem;">
                <strong style="color:#4ade80;">Sending to ${opened} client(s):</strong>
                <ul style="margin-top:0.5rem;padding-left:1.25rem;font-size:0.85rem;">
                    ${results.map(r => `<li>${r}</li>`).join('')}
                </ul>
            </div>`;
    }

    showToast(`Opening WhatsApp for ${opened} client(s)...`, 'success');
}

// ============================================================
//  SHARE RECEIPT FROM MODAL (set by receipts.js openReceiptModal)
// ============================================================
let _currentReceiptForWa = null;

function shareReceiptWhatsApp() {
    const receipt = _currentReceiptForWa;
    if (!receipt) { showToast('No receipt selected', 'error'); return; }

    const phone = receipt.clientPhone || '';
    const name = receipt.clientName || 'Client';
    const amount = (receipt.total || 0).toFixed(2);
    const month = receipt.month || '';
    const year = receipt.year || '';
    const id = receipt.id || '';
    const status = receipt.paymentStatus || 'Pending';

    const msg = `Hi ${name} 👋,

Here is your *TransitPay Receipt* — *${id}*

💰 *Amount:* RM ${amount}
📅 *Period:* ${month} ${year}
📋 *Status:* ${status}

Thank you for using our transport service! 🚌

— TransitPay`;

    if (!phone) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(msg).then(() =>
                showToast('No phone number — message copied to clipboard!', 'info')
            );
        } else {
            showToast('No phone number saved for this client', 'error');
        }
        return;
    }

    const url = `https://wa.me/${formatPhone(phone)}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
    showToast(`Opening WhatsApp for ${name} ✅`, 'success');
}

// ============================================================
//  OLD STUBS (kept so nothing crashes)
// ============================================================
function previewInvoiceEmail() { showToast("Use WhatsApp instead — it's faster! 💬", 'info'); }
function sendInvoiceEmails() { showToast("Use WhatsApp instead — it's faster! 💬", 'info'); }
function loadEmailHistory() { }