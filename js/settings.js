/* ============================
   TRANSITPAY - Settings
   ============================ */

// ==================== CAR PLATE MANAGEMENT ====================
function populateCarPlateDropdown() {
    const select = document.getElementById('petrolCarPlate');
    if (!select) return;
    const plates = appData.carPlates || ['BPE813', 'SMN1538'];
    const currentVal = select.value;
    select.innerHTML = '<option value="">-- Select Car --</option>' +
        plates.map(p => `<option value="${p}">${p}</option>`).join('');
    if (currentVal) select.value = currentVal;
}

function addCarPlate() {
    const input = document.getElementById('newCarPlate');
    const val = input.value.trim().toUpperCase();
    if (!val) {
        showToast('Please enter a car number plate', 'error');
        return;
    }
    if (!appData.carPlates) appData.carPlates = ['BPE813', 'SMN1538'];
    if (appData.carPlates.includes(val)) {
        showToast('This plate already exists', 'error');
        return;
    }
    appData.carPlates.push(val);
    saveAppData(appData);
    input.value = '';
    renderCarPlateTags();
    populateCarPlateDropdown();
    showToast('Car plate added: ' + val, 'success');
}

function removeCarPlate(plate) {
    if (!confirm('Remove car plate "' + plate + '"?')) return;
    appData.carPlates = (appData.carPlates || []).filter(p => p !== plate);
    saveAppData(appData);
    renderCarPlateTags();
    populateCarPlateDropdown();
    showToast('Car plate removed', 'success');
}

function renderCarPlateTags() {
    const container = document.getElementById('carPlatesList');
    if (!container) return;
    const plates = appData.carPlates || [];
    container.innerHTML = plates.map(p => `
        <span class="tag-item">
            <span style="font-family:var(--font-mono);font-weight:600;">${p}</span>
            <button class="tag-remove" onclick="removeCarPlate('${p}')" title="Remove">&times;</button>
        </span>
    `).join('');
}

// ==================== LOCATION MANAGEMENT ====================
function addLocation() {
    const input = document.getElementById('newLocationName');
    const val = input.value.trim();
    if (!val) {
        showToast('Please enter a location name', 'error');
        return;
    }
    if (appData.locations.includes(val)) {
        showToast('This location already exists', 'error');
        return;
    }
    appData.locations.push(val);
    appData.locations.sort();
    saveAppData(appData);
    input.value = '';
    renderLocationTags();
    populateLocationDropdowns();
    showToast('Location added: ' + val, 'success');
}

function removeLocation(loc) {
    if (!confirm('Remove location "' + loc + '"?')) return;
    appData.locations = appData.locations.filter(l => l !== loc);
    saveAppData(appData);
    renderLocationTags();
    populateLocationDropdowns();
    showToast('Location removed', 'success');
}

function renderLocationTags() {
    const container = document.getElementById('locationsList');
    if (!container) return;
    const locations = appData.locations || [];
    container.innerHTML = locations.map(l => `
        <span class="tag-item">
            ${l}
            <button class="tag-remove" onclick="removeLocation('${l.replace(/'/g, "\\'")}')" title="Remove">&times;</button>
        </span>
    `).join('');
}