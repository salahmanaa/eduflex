// Fetch and update admin dashboard values dynamically

document.addEventListener('DOMContentLoaded', async function() {
    // --- 1. Update Stats Cards ---
    try {
        const statsRes = await fetch('/api/admin/stats');
        const stats = await statsRes.json();
        // Update the stats cards (replace static values)
        // Utilisateurs actifs
        const usersCard = document.querySelector('.card-stat.text-primary h3');
        if (usersCard) usersCard.textContent = stats.students + stats.teachers + stats.admins;
        // Formateurs
        const teachersCard = document.querySelector('.card-stat.text-warning h3');
        if (teachersCard) teachersCard.textContent = stats.teachers;
        // Certifications (assuming quizzes as certifications)
        const certCard = document.querySelector('.card-stat.text-info h3');
        if (certCard) certCard.textContent = '0';
    } catch (e) {
        console.error('Failed to fetch stats:', e);
    }

    // --- 2. Update User Registrations Chart ---
    try {
        const regRes = await fetch('/api/admin/user-registrations?period=day');
        const regData = await regRes.json();
        const labels = regData.map(d => d.label);
        const data = regData.map(d => d.count);
        // Update the chart if Chart.js is loaded
        if (window.Chart && document.getElementById('userRegistrationsChart')) {
            new Chart(document.getElementById('userRegistrationsChart'), {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Nouvelles inscriptions',
                        data: data,
                        borderColor: '#0d6efd',
                        backgroundColor: 'rgba(13, 110, 253, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true },
                        x: {}
                    }
                }
            });
        }
    } catch (e) {
        console.error('Failed to fetch registration stats:', e);
    }

    // --- 3. (Optional) Update Engagement Chart with dummy or real data if available ---
    // You can add more fetches for other dashboard elements as needed

    // --- 4. Update Profile and Welcome Message ---
    try {
        const profileRes = await fetch('/api/auth/me');
        if (profileRes.ok) {
            const profile = await profileRes.json();
            // Update profile name and role in navbar
            const nameEls = document.querySelectorAll('.navbar-profile p.fw-medium, .navbar-profile .fw-medium');
            nameEls.forEach(el => el.textContent = profile.firstName + ' ' + profile.lastName);
            const roleEls = document.querySelectorAll('.navbar-profile p.text-muted, .navbar-profile .text-muted.small');
            roleEls.forEach(el => el.textContent = profile.role.charAt(0).toUpperCase() + profile.role.slice(1));
            // Update welcome message
            const welcomeTitle = document.querySelector('.card-body h3.fw-bold');
            if (welcomeTitle) welcomeTitle.textContent = `Bienvenue, ${profile.firstName} ! 👋`;
        }
    } catch (e) {
        console.error('Failed to fetch profile:', e);
    }

    // --- 6. Update Activités récentes with real data ---
    try {
        const recentRes = await fetch('/api/admin/recent-registrations');
        if (recentRes.ok) {
            const recent = await recentRes.json();
            const timeline = document.querySelector('.timeline');
            if (timeline) {
                timeline.innerHTML = recent.length ? recent.map(user => {
                    const date = new Date(user.createdAt);
                    const now = new Date();
                    const diffMs = now - date;
                    const diffMin = Math.floor(diffMs / 60000);
                    let timeAgo = '';
                    if (diffMin < 60) timeAgo = `Il y a ${diffMin} minute${diffMin > 1 ? 's' : ''}`;
                    else if (diffMin < 1440) timeAgo = `Il y a ${Math.floor(diffMin/60)} heure${Math.floor(diffMin/60) > 1 ? 's' : ''}`;
                    else timeAgo = date.toLocaleDateString('fr-FR');
                    return `<div class="timeline-item">
                        <p class="mb-1 fw-medium">${timeAgo}</p>
                        <div class="d-flex align-items-center">
                            <div class="flex-shrink-0">
                                <img src="https://placehold.co/40x40?text=${user.firstName.charAt(0)}" class="avatar" alt="User">
                            </div>
                            <div class="ms-2">
                                <p class="mb-0 fw-medium">Nouveau compte créé</p>
                                <p class="text-muted small mb-0">${user.firstName} ${user.lastName} <span class='badge bg-secondary ms-2'>${user.role}</span></p>
                            </div>
                        </div>
                    </div>`;
                }).join('') : '<div class="timeline-item"><p class="mb-0">Aucune activité récente</p></div>';
            }
        }
    } catch (e) {
        console.error('Failed to fetch recent activities:', e);
    }
}); 