// teacher-statistics.js

document.addEventListener('DOMContentLoaded', function () {
    fetchAndRenderStatistics();
});

async function fetchAndRenderStatistics() {
    try {
        const response = await fetch('/api/teachers/dashboard/stats', {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) throw new Error('Erreur lors du chargement des statistiques');
        const data = await response.json();
        if (!data.success) throw new Error(data.message || 'Erreur lors du chargement des statistiques');
        const stats = data.stats;
        renderStatCards(stats);
        renderCharts(stats);
        renderCoursePerformance(stats);
        renderRecentActivities(stats);
    } catch (err) {
        console.error(err);
        showError('Impossible de charger les statistiques.');
    }
}

function renderStatCards(stats) {
    document.getElementById('stat-total-students').textContent = stats.totalStudents || 0;
    document.getElementById('stat-total-students-change').textContent = '';
    document.getElementById('stat-success-rate').textContent = (stats.successRate || 0) + '%';
    document.getElementById('stat-success-rate-change').textContent = '';
    document.getElementById('stat-engagement').textContent = (stats.engagement || 0) + '%';
    document.getElementById('stat-engagement-change').textContent = '';
    document.getElementById('stat-satisfaction').textContent = (stats.averageSatisfaction ? (stats.averageSatisfaction/20).toFixed(1) : '0') + '/5';
    document.getElementById('stat-satisfaction-change').textContent = '';
}

function renderCharts(stats) {
    // --- Performance Chart (real data) ---
    // We'll use recentQuizAttempts to build a performance curve over the last 7 days
    let labels = [];
    let data = [];
    if (stats.recentQuizAttempts && stats.recentQuizAttempts.length > 0) {
        // Group quiz attempts by day (last 7 days)
        const dayMap = {};
        for (let i = 0; i < 7; i++) {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            const key = d.toISOString().slice(0, 10);
            labels.push(d.toLocaleDateString());
            dayMap[key] = [];
        }
        stats.recentQuizAttempts.forEach(attempt => {
            if (attempt.completedAt) {
                const key = new Date(attempt.completedAt).toISOString().slice(0, 10);
                if (dayMap[key]) {
                    dayMap[key].push(attempt.score);
                }
            }
        });
        data = labels.map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            const key = d.toISOString().slice(0, 10);
            const scores = dayMap[key];
            if (scores && scores.length > 0) {
                return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
            } else {
                return 0;
            }
        });
    } else {
        // fallback
        labels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
        data = [0,0,0,0,0,0,0];
    }
    const perfCtx = document.getElementById('performanceChart').getContext('2d');
    new Chart(perfCtx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Performance moyenne',
                data: data,
                borderColor: '#0d6efd',
                tension: 0.4,
                fill: false
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // --- Course Distribution Chart (real data) ---
    // We'll use recentCourses to show the number of students per course
    let distLabels = [];
    let distData = [];
    if (stats.recentCourses && stats.recentCourses.length > 0) {
        distLabels = stats.recentCourses.map(c => c.title);
        distData = stats.recentCourses.map(c => c.studentCount || 0);
    }
    const distCtx = document.getElementById('courseDistributionChart').getContext('2d');
    new Chart(distCtx, {
        type: 'doughnut',
        data: {
            labels: distLabels,
            datasets: [{
                data: distData,
                backgroundColor: ['#0d6efd', '#198754', '#ffc107', '#dc3545', '#6f42c1', '#20c997']
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function renderCoursePerformance(stats) {
    const tbody = document.getElementById('course-performance-tbody');
    tbody.innerHTML = '';
    if (!stats.recentCourses || stats.recentCourses.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Aucun cours</td></tr>';
        return;
    }
    stats.recentCourses.forEach(course => {
        tbody.innerHTML += `
            <tr>
                <td>${course.title}</td>
                <td>${course.studentCount}</td>
                <td>${course.rating || 'N/A'}</td>
                <td>
                    <div class="progress" style="height: 6px;">
                        <div class="progress-bar bg-success" style="width: ${course.rating ? (course.rating*20) : 0}%"></div>
                    </div>
                </td>
            </tr>
        `;
    });
}

function renderRecentActivities(stats) {
    const container = document.getElementById('recent-activities-list');
    container.innerHTML = '';
    if (!stats.recentQuizAttempts || stats.recentQuizAttempts.length === 0) {
        container.innerHTML = '<div class="list-group-item text-center text-muted">Aucune activité récente</div>';
        return;
    }
    stats.recentQuizAttempts.forEach(attempt => {
        container.innerHTML += `
            <div class="list-group-item p-3">
                <div class="d-flex align-items-center">
                    <div class="activity-icon bg-primary bg-opacity-10 text-primary me-3">
                        <i class="fas fa-graduation-cap"></i>
                    </div>
                    <div>
                        <p class="mb-1 fw-medium">Quiz complété : ${attempt.quizTitle}</p>
                        <p class="text-muted small mb-0">${attempt.studentName} - Score: ${attempt.score}</p>
                    </div>
                    <span class="text-muted small ms-auto">${formatDate(attempt.completedAt)}</span>
                </div>
            </div>
        `;
    });
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

function showError(msg) {
    alert(msg);
} 