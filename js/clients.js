/* ============================
   TRANSITPAY - Client Management
   ============================ */

// ==================== CLIENT MANAGEMENT ====================
function saveClient(e) {
    e.preventDefault();

    const name = document.getElementById('newClientName').value.trim();
    const phone = document.getElementById('newClientPhone').value.trim();
    const email = document.getElementById('newClientEmail').value.trim();
    const address = document.getElementById('newClientAddress').value.trim();
    const route = document.getElementById('newClientRoute').value.trim();
    const monthlyRate = parseFloat(document.getElementById('newClientMonthlyRate').value) || 0;
    const notes = document.getElementById('newClientNotes').value.trim();
    const editingId = document.getElementById('editingClientId').value;

    if (!name || !phone) {
        showToast('Client name and phone are required', 'error');
        return false;
    }

    if (editingId) {
        // Update existing client
        const idx = appData.clients.findIndex(c => c.id === editingId);
        if (idx !== -1) {
            appData.clients[idx] = {
                ...appData.clients[idx],
                name, phone, email, address, route, monthlyRate, notes,
                updatedAt: new Date().toISOString()
            };
            showToast('Client updated successfully!', 'success');
        }
    } else {
        // Check for duplicate phone
        const duplicate = appData.clients.find(c => c.phone === phone);
        if (duplicate) {
            showToast('A client with this phone number already exists', 'error');
            return false;
        }

        // Add new client
        const client = {
            id: 'CL-' + Date.now(),
            name, phone, email, address, route, monthlyRate, notes,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        appData.clients.push(client);
        showToast('Client added successfully!', 'success');
    }

    saveAppData(appData);
    clearClientForm();
    loadClients();
    populateClientDropdown();
    return false;
}

function clearClientForm() {
    document.getElementById('clientForm').reset();
    document.getElementById('editingClientId').value = '';
    document.getElementById('saveClientBtn').innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        Add Client
    `;
    document.querySelector('#clientsSection .form-section-title').textContent = 'Add New Client';
}

function editClient(clientId) {
    const client = appData.clients.find(c => c.id === clientId);
    if (!client) return;

    document.getElementById('newClientName').value = client.name;
    document.getElementById('newClientPhone').value = client.phone;
    document.getElementById('newClientEmail').value = client.email || '';
    document.getElementById('newClientAddress').value = client.address || '';
    document.getElementById('newClientRoute').value = client.route || '';
    document.getElementById('newClientMonthlyRate').value = client.monthlyRate || '';
    document.getElementById('newClientNotes').value = client.notes || '';
    document.getElementById('editingClientId').value = client.id;

    document.getElementById('saveClientBtn').innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 13l1.5-5L12 1l3 3-7.5 7.5L3 13z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
        </svg>
        Update Client
    `;
    document.querySelector('#clientsSection .form-section-title').textContent = 'Edit Client';

    // Scroll to form
    document.getElementById('clientForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function deleteClient(clientId) {
    if (!confirm('Are you sure you want to delete this client?')) return;

    appData.clients = appData.clients.filter(c => c.id !== clientId);
    saveAppData(appData);
    loadClients();
    populateClientDropdown();
    showToast('Client deleted', 'info');
}

function loadClients() {
    const tbody = document.getElementById('clientsTableBody');
    const countEl = document.getElementById('clientCount');
    const searchVal = (document.getElementById('clientSearch')?.value || '').toLowerCase();

    let clients = appData.clients || [];

    // Search filter
    if (searchVal) {
        clients = clients.filter(c =>
            c.name.toLowerCase().includes(searchVal) ||
            c.phone.toLowerCase().includes(searchVal) ||
            (c.address || '').toLowerCase().includes(searchVal) ||
            (c.route || '').toLowerCase().includes(searchVal)
        );
    }

    countEl.textContent = clients.length;

    if (clients.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="6">
                    <div class="empty-state-mini">
                        <p>${searchVal ? 'No clients match your search.' : 'No clients added yet. Add your first client above!'}</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = clients.map(c => `
        <tr>
            <td><strong>${c.name}</strong></td>
            <td>${c.phone}</td>
            <td>${c.address || '<span style="color:var(--text-muted);">â€”</span>'}</td>
            <td>${c.route || '<span style="color:var(--text-muted);">â€”</span>'}</td>
            <td style="font-family:var(--font-mono);font-weight:600;">${c.monthlyRate ? 'RM ' + c.monthlyRate.toFixed(2) : '<span style="color:var(--text-muted);">â€”</span>'}</td>
            <td>
                <div class="action-btn-group">
                    <button class="btn-action" onclick="editClient('${c.id}')" title="Edit">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                            <path d="M3 13l1.5-5L12 1l3 3-7.5 7.5L3 13z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
                        </svg>
                    </button>
                    <button class="btn-action btn-action-danger" onclick="deleteClient('${c.id}')" title="Delete">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                            <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                        </svg>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// ==================== CLIENT DROPDOWN (Receipt Form) ====================
function populateClientDropdown() {
    const select = document.getElementById('clientSelect');
    if (!select) return;

    const clients = appData.clients || [];
    let options = '<option value="">-- Type manually or select a client --</option>';
    clients.forEach(c => {
        options += `<option value="${c.id}">${c.name} (${c.phone})</option>`;
    });
    select.innerHTML = options;
}

function onClientSelect() {
    const select = document.getElementById('clientSelect');
    const clientId = select.value;

    if (!clientId) {
        // Clear the client info fields (let user type manually)
        document.getElementById('clientName').value = '';
        document.getElementById('clientPhone').value = '';
        document.getElementById('clientAddress').value = '';
        document.getElementById('monthlyRoute').value = '';
        document.getElementById('monthlyAmount').value = '';
        return;
    }

    const client = appData.clients.find(c => c.id === clientId);
    if (!client) return;

    // Auto-fill client details
    document.getElementById('clientName').value = client.name;
    document.getElementById('clientPhone').value = client.phone;
    document.getElementById('clientAddress').value = client.address || '';

    // Auto-fill monthly payment details if available
    if (client.route) {
        document.getElementById('monthlyRoute').value = client.route;
    }
    if (client.monthlyRate) {
        document.getElementById('monthlyAmount').value = client.monthlyRate;
    }

    showToast(`Client "${client.name}" loaded`, 'success');
}