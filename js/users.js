/* ============================
   TRANSITPAY - User Accounts
   ============================ */

// ==================== USER ACCOUNTS ====================
function saveUser(e) {
    e.preventDefault();

    const name = document.getElementById('newUserName').value.trim();
    const phone = document.getElementById('newUserPhone').value.trim();
    const role = document.getElementById('newUserRole').value;
    const status = document.getElementById('newUserStatus').value;
    const editingId = document.getElementById('editingUserId').value;

    if (!name || !phone) {
        showToast('User name and phone are required', 'error');
        return false;
    }

    const normalizedPhone = '+' + phone.replace(/^\+/, '');

    if (editingId) {
        // Update existing user
        const idx = appData.users.findIndex(u => u.id === editingId);
        if (idx !== -1) {
            appData.users[idx] = {
                ...appData.users[idx],
                name, phone: normalizedPhone, role, status,
                updatedAt: new Date().toISOString()
            };
            showToast('User updated successfully!', 'success');
        }
    } else {
        // Check for duplicate phone
        const duplicate = appData.users.find(u => {
            const uPhone = '+' + u.phone.replace(/^\+/, '');
            return uPhone === normalizedPhone;
        });
        if (duplicate) {
            showToast('A user with this phone number already exists', 'error');
            return false;
        }

        // Add new user
        const user = {
            id: 'USR-' + Date.now(),
            name, phone: normalizedPhone, role, status,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        appData.users.push(user);
        showToast('User account created!', 'success');
    }

    saveAppData(appData);
    clearUserForm();
    loadUsers();
    return false;
}

function clearUserForm() {
    document.getElementById('userForm').reset();
    document.getElementById('editingUserId').value = '';
    document.getElementById('saveUserBtn').innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        Add User
    `;
    const titleEl = document.getElementById('userFormTitle');
    if (titleEl) titleEl.textContent = 'Add New User';
}

function editUser(userId) {
    const user = appData.users.find(u => u.id === userId);
    if (!user) return;

    document.getElementById('newUserName').value = user.name;
    document.getElementById('newUserPhone').value = user.phone.replace(/^\+/, '');
    document.getElementById('newUserRole').value = user.role;
    document.getElementById('newUserStatus').value = user.status;
    document.getElementById('editingUserId').value = user.id;

    document.getElementById('saveUserBtn').innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 13l1.5-5L12 1l3 3-7.5 7.5L3 13z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
        </svg>
        Update User
    `;
    const titleEl = document.getElementById('userFormTitle');
    if (titleEl) titleEl.textContent = 'Edit User';

    // Scroll to form
    document.getElementById('userForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user account?')) return;

    // Don't allow deleting the currently logged in user
    const user = appData.users.find(u => u.id === userId);
    if (user && appData.user && user.phone === appData.user.phone) {
        showToast('You cannot delete your own account', 'error');
        return;
    }

    appData.users = appData.users.filter(u => u.id !== userId);
    saveAppData(appData);
    loadUsers();
    showToast('User account deleted', 'info');
}

function loadUsers() {
    const tbody = document.getElementById('usersTableBody');
    const users = appData.users || [];

    // Update count badges
    const countEl = document.getElementById('userCount');
    const countEl2 = document.getElementById('usersTableCount');
    const countText = users.length + ' User' + (users.length !== 1 ? 's' : '');
    if (countEl) countEl.textContent = countText;
    if (countEl2) countEl2.textContent = users.length;

    if (users.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="6">
                    <div class="empty-state-mini">
                        <p>No user accounts created yet. Anyone can login until you add users.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = users.map(u => {
        const roleBadgeClass = u.role === 'Admin' ? 'badge-admin' : (u.role === 'Operator' ? 'badge-operator' : 'badge-viewer');
        const statusBadgeClass = u.status === 'Active' ? 'badge-active' : 'badge-inactive';
        const isCurrentUser = appData.user && u.phone === appData.user.phone;

        return `
            <tr>
                <td><strong>${u.name}</strong>${isCurrentUser ? ' <span style="color:var(--primary-400);font-size:0.7rem;">(you)</span>' : ''}</td>
                <td>${u.phone}</td>
                <td><span class="badge ${roleBadgeClass}">${u.role}</span></td>
                <td><span class="badge ${statusBadgeClass}">${u.status}</span></td>
                <td>${formatDate(u.createdAt?.split('T')[0])}</td>
                <td>
                    <div class="action-btn-group">
                        <button class="btn-action" onclick="editUser('${u.id}')" title="Edit">
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                                <path d="M3 13l1.5-5L12 1l3 3-7.5 7.5L3 13z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
                            </svg>
                        </button>
                        <button class="btn-action btn-action-danger" onclick="deleteUser('${u.id}')" title="Delete"${isCurrentUser ? ' disabled style="opacity:0.3;cursor:not-allowed;"' : ''}>
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                                <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}