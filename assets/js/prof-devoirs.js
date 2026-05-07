// prof-devoirs.js
// Handles dynamic devoir (assignment) management for professors
// Assumes authentication and user info are available (e.g., via cookies or localStorage)

// Utility: Get auth token (adjust as needed for your auth system)
function getAuthToken() {
    return localStorage.getItem('token'); // or from cookies
}

// Utility: Get current professor's ID (adjust as needed)
function getProfessorId() {
    return localStorage.getItem('userId');
}

// Fetch courses for the current professor
async function fetchCourses() {
    const token = getAuthToken();
    const res = await fetch('/api/teacher/courses', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.courses || [];
}

// Fetch assignments for a course
async function fetchDevoirs(courseId) {
    const token = getAuthToken();
    const res = await fetch(`/api/teacher/courses/${courseId}/devoirs`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.devoirs || [];
}

// Render courses in the 'Créer un devoir' modal
async function renderCourseOptions() {
    const courses = await fetchCourses();
    const select = document.getElementById('select-course');
    if (!select) return;
    select.innerHTML = '';
    courses.forEach(course => {
        const opt = document.createElement('option');
        opt.value = course._id;
        opt.textContent = course.title;
        select.appendChild(opt);
    });
}

// Add a button to view submissions in each devoir card
function addViewSubmissionsButton(container, devoirId) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-outline-secondary btn-view-submissions ms-2';
    btn.textContent = 'Voir les soumissions';
    btn.setAttribute('data-devoir-id', devoirId);
    btn.addEventListener('click', async function() {
        await renderDevoirSubmissions(devoirId);
        const modal = new bootstrap.Modal(document.getElementById('submissionsModal'));
        modal.show();
    });
    container.appendChild(btn);
}

// Fetch and display all submissions for a devoir
async function renderDevoirSubmissions(devoirId) {
    const token = getAuthToken();
    const res = await fetch(`/api/teacher/devoirs/${devoirId}/submissions`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    const container = document.getElementById('devoir-submissions');
    if (!data.success || !data.submissions.length) {
        container.innerHTML = '<div class="alert alert-info">Aucune soumission pour ce devoir.</div>';
        return;
    }
    let html = `<table class="table table-bordered"><thead>
        <tr><th>Étudiant</th><th>Email</th><th>Date de soumission</th><th>PDF</th></tr>
    </thead><tbody>`;
    for (const sub of data.submissions) {
        html += `<tr>
            <td>${sub.student.firstName} ${sub.student.lastName}</td>
            <td>${sub.student.email}</td>
            <td>${new Date(sub.submittedAt).toLocaleString()}</td>
            <td><a href="${sub.fileUrl}" target="_blank">Voir PDF</a></td>
        </tr>`;
    }
    html += '</tbody></table>';
    container.innerHTML = html;
}

// Render assignments for all courses
async function renderDevoirs() {
    const courses = await fetchCourses();
    const container = document.querySelector('.main-content .row.g-4');
    if (!container) return;
    container.innerHTML = '';
    for (const course of courses) {
        const devoirs = await fetchDevoirs(course._id);
        devoirs.forEach(devoir => {
            const col = document.createElement('div');
            col.className = 'col-md-6';
            col.innerHTML = `
                <div class="card">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <span class="badge badge-course">${course.title}</span>
                            <span class="badge bg-warning text-dark">En cours</span>
                        </div>
                        <h5 class="card-title fw-bold mb-2">${devoir.title}</h5>
                        <p class="text-muted mb-3">${devoir.description || ''}</p>
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <div class="d-flex align-items-center">
                                <i class="fas fa-file-pdf me-2 text-muted"></i>
                                <a href="${devoir.fileUrl}" target="_blank">Fichier</a>
                            </div>
                        </div>
                        <div class="d-flex justify-content-between">
                            <button class="btn btn-primary btn-edit" data-id="${devoir._id}">Modifier</button>
                            <button class="btn btn-danger btn-delete" data-id="${devoir._id}">Supprimer</button>
                        </div>
                        <div class="mt-2" id="view-submissions-btn-${devoir._id}"></div>
                    </div>
                </div>
            `;
            container.appendChild(col);
            // Add the view submissions button
            addViewSubmissionsButton(col.querySelector(`#view-submissions-btn-${devoir._id}`), devoir._id);
        });
    }
}

// Handle create devoir form submission
async function handleCreateDevoir(e) {
    e.preventDefault();
    console.log("Form submitted");
    const form = e.target;
    const formData = new FormData(form);
    const courseId = form.querySelector('select').value;
    const token = getAuthToken();
    const res = await fetch(`/api/teacher/courses/${courseId}/devoirs`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
    });
    if (res.ok) {
        await renderDevoirs();
        // Close modal
        document.querySelector('#newAssignmentModal .btn-close').click();
        form.reset();
    } else {
        alert('Erreur lors de la création du devoir');
    }
}

// Show edit modal with devoir data
function openEditModal(devoir) {
    document.getElementById('edit-devoir-id').value = devoir._id;
    document.getElementById('edit-devoir-title').value = devoir.title;
    document.getElementById('edit-devoir-description').value = devoir.description || '';
    document.getElementById('edit-devoir-file').value = '';
    const editModal = new bootstrap.Modal(document.getElementById('editAssignmentModal'));
    editModal.show();
}

// Handle click on edit button
async function handleEditDevoir(e) {
    if (!e.target.classList.contains('btn-edit')) return;
    const devoirId = e.target.dataset.id;
    // Find the devoir data from the DOM (or re-fetch if needed)
    // For simplicity, fetch from backend
    const token = getAuthToken();
    const res = await fetch(`/api/teacher/devoirs/${devoirId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return alert('Erreur lors de la récupération du devoir');
    const data = await res.json();
    openEditModal(data.devoir || data);
}

// Handle edit form submit
async function handleEditFormSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const devoirId = document.getElementById('edit-devoir-id').value;
    const formData = new FormData(form);
    const token = getAuthToken();
    const res = await fetch(`/api/teacher/devoirs/${devoirId}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
    });
    if (res.ok) {
        await renderDevoirs();
        bootstrap.Modal.getInstance(document.getElementById('editAssignmentModal')).hide();
    } else {
        alert('Erreur lors de la modification du devoir');
    }
}

// Handle delete devoir with SweetAlert confirmation
async function handleDeleteDevoir(e) {
    if (!e.target.classList.contains('btn-delete')) return;
    const devoirId = e.target.dataset.id;
    const result = await Swal.fire({
        title: 'Supprimer ce devoir ?',
        text: 'Cette action est irréversible.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Oui, supprimer',
        cancelButtonText: 'Annuler'
    });
    if (!result.isConfirmed) return;
    const token = getAuthToken();
    const res = await fetch(`/api/teacher/devoirs/${devoirId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
        await renderDevoirs();
        Swal.fire('Supprimé !', 'Le devoir a été supprimé.', 'success');
    } else {
        Swal.fire('Erreur', 'Erreur lors de la suppression', 'error');
    }
}

// Init
window.addEventListener('DOMContentLoaded', () => {
    renderCourseOptions();
    renderDevoirs();
    // Create devoir
    document.querySelector('#newAssignmentModal form').addEventListener('submit', handleCreateDevoir);
    // Edit devoir
    document.getElementById('edit-devoir-form').addEventListener('submit', handleEditFormSubmit);
    // Delete/edit devoirs
    document.querySelector('.main-content .row.g-4').addEventListener('click', handleDeleteDevoir);
    document.querySelector('.main-content .row.g-4').addEventListener('click', handleEditDevoir);
}); 