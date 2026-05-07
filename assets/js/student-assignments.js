// Fetch all courses the student is enrolled in
async function fetchStudentCourses() {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/student/courses', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.courses || [];
}

// Fetch all devoirs for a given course
async function fetchDevoirsForCourse(courseId) {
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/student/courses/${courseId}/devoirs`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.devoirs || [];
}

// Fetch the student's submission for a given devoir
async function fetchSubmission(devoirId) {
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/student/devoirs/${devoirId}/submission`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.submission;
}

// Submit a PDF for a devoir
async function submitDevoir(devoirId, file, refreshCallback) {
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('pdf', file);
    const res = await fetch(`/api/student/devoirs/${devoirId}/submit`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
    });
    const data = await res.json();
    if (res.ok && refreshCallback) await refreshCallback();
    return data;
}

async function renderAssignments() {
    const container = document.getElementById('student-assignments-list');
    container.innerHTML = '<div class="text-center">Chargement...</div>';
    const courses = await fetchStudentCourses();
    if (!courses.length) {
        container.innerHTML = '<div class="alert alert-info">Vous n\'êtes inscrit à aucun cours pour le moment.</div>';
        // Reset stats if no courses
        if (document.getElementById('total-devoirs')) document.getElementById('total-devoirs').textContent = '0';
        if (document.getElementById('completed-devoirs')) document.getElementById('completed-devoirs').textContent = '0';
        if (document.getElementById('upcoming-devoirs')) document.getElementById('upcoming-devoirs').textContent = '0';
        return;
    }
    let html = '';
    let hasDevoirs = false;
    let totalDevoirs = 0;
    let completedDevoirs = 0;
    let coursesWithoutDevoirs = 0;
    for (const course of courses) {
        const devoirs = await fetchDevoirsForCourse(course._id);
        if (!devoirs.length) {
            coursesWithoutDevoirs++;
            html += `<div class="mb-4"><h4 class="mb-3">${course.title}</h4><div class="alert alert-warning">Aucun devoir pour ce cours.</div></div>`;
            continue;
        }
        hasDevoirs = true;
        html += `<div class="mb-4"><h4 class="mb-3">${course.title}</h4><div class="list-group list-group-flush">`;
        for (const devoir of devoirs) {
            totalDevoirs++;
            const submission = await fetchSubmission(devoir._id);
            if (submission && submission.fileUrl) completedDevoirs++;
            html += `<div class="list-group-item p-3">
                <div class="d-flex align-items-center">
                    <div class="flex-grow-1">
                        <div class="d-flex justify-content-between align-items-center mb-1">
                            <span class="badge badge-ai">${course.title}</span>
                            <span class="text-muted small">
                                <i class="fas fa-calendar me-1"></i> ${devoir.deadline ? 'Échéance: ' + new Date(devoir.deadline).toLocaleDateString() : ''}
                            </span>
                        </div>
                        <h6 class="mb-1 fw-bold">${devoir.title}</h6>
                        <p class="text-muted small mb-0">${devoir.description || ''}</p>
                        <div class="mb-2">
                            <a href="${devoir.fileUrl}" target="_blank">Voir le sujet (PDF)</a>
                        </div>`;
            if (submission && submission.fileUrl) {
                html += `<div class="alert alert-success mb-2">Déjà soumis le ${new Date(submission.submittedAt).toLocaleString()}<br>
                    <a href="${submission.fileUrl}" target="_blank">Voir mon PDF soumis</a></div>`;
            } else {
                html += `<form class="devoir-upload-form" data-devoir-id="${devoir._id}">
                    <div class="input-group mb-2">
                        <input type="file" class="form-control" accept="application/pdf" required>
                        <button type="submit" class="btn btn-primary">Soumettre mon PDF</button>
                    </div>
                </form>`;
            }
            html += `</div></div></div>`;
        }
        html += `</div></div>`;
    }
    if (!hasDevoirs) {
        html = '<div class="alert alert-info">Aucun devoir à afficher pour vos cours inscrits.</div>';
    }
    container.innerHTML = html;

    // Update stats
    if (document.getElementById('total-devoirs')) document.getElementById('total-devoirs').textContent = totalDevoirs;
    if (document.getElementById('completed-devoirs')) document.getElementById('completed-devoirs').textContent = completedDevoirs;
    if (document.getElementById('upcoming-devoirs')) document.getElementById('upcoming-devoirs').textContent = coursesWithoutDevoirs;

    // Attach submit handlers
    document.querySelectorAll('.devoir-upload-form').forEach(form => {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            const devoirId = form.getAttribute('data-devoir-id');
            const fileInput = form.querySelector('input[type="file"]');
            if (!fileInput.files.length) return;
            const result = await submitDevoir(devoirId, fileInput.files[0], renderAssignments);
            if (result && result.success) {
                Swal.fire({
                    icon: 'success',
                    title: 'Succès',
                    text: 'Votre devoir a été soumis avec succès !',
                    confirmButtonText: 'OK'
                });
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Erreur',
                    text: (result && result.message) || 'Une erreur est survenue lors de la soumission.'
                });
            }
        });
    });
}

window.addEventListener('DOMContentLoaded', renderAssignments); 