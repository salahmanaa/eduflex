// Student Dashboard Script
document.addEventListener('DOMContentLoaded', async function() {
    // Check authentication
    // Temporarily disabled for debugging
    // if (!await checkAuth()) {
    //     window.location.href = '../index.html';
    //     return;
    // }

    // Load dashboard data
    await loadDashboardData();
    setupEventListeners();
});

// Check authentication
async function checkAuth() {
    try {
        const response = await fetch('/api/auth/check', {
            credentials: 'include'
        });
        
        if (!response.ok) {
            return false;
        }
        
        const data = await response.json();
        console.log('Auth check response:', data);
        return data.authenticated && data.user && data.user.role === 'student';
    } catch (error) {
        console.error('Auth check error:', error);
        return false;
    }
}

// Load dashboard statistics
async function loadDashboardData() {
    try {
        const response = await fetch('/api/student/dashboard/stats', {
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.message || 'Failed to load dashboard data');
        }

        updateDashboardStats(data.stats);
        updateRecentCourses(data.stats.recentCourses);
        updateRecentQuizAttempts(data.stats.recentQuizAttempts);
        updateRecentAssignments(data.stats.recentAssignments);
        updateUpcomingDeadlines(data.stats.upcomingDeadlines);
        updateTodaySchedule(data.stats.todayEvents);
        updateUserProfile();

    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showError('Erreur lors du chargement des données du tableau de bord');
    }
}

// Update dashboard statistics
function updateDashboardStats(stats) {
    // Update stat cards
    const activeCoursesElement = document.querySelector('.card-stat .fas.fa-book-open').parentElement.querySelector('h3');
    if (activeCoursesElement) {
        activeCoursesElement.textContent = stats.activeCourses;
    }

    const certificationsElement = document.querySelector('.card-stat .fas.fa-certificate').parentElement.querySelector('h3');
    if (certificationsElement) {
        certificationsElement.textContent = stats.certifications;
    }

    const pendingAssignmentsElement = document.querySelector('.card-stat .fas.fa-tasks').parentElement.querySelector('h3');
    if (pendingAssignmentsElement) {
        pendingAssignmentsElement.textContent = stats.pendingAssignments;
    }

    const studyHoursElement = document.querySelector('.card-stat .fas.fa-clock').parentElement.querySelector('h3');
    if (studyHoursElement) {
        studyHoursElement.textContent = `${stats.studyHours}h`;
    }

    // Update progress bar
    const progressBar = document.querySelector('.progress-bar.bg-success');
    if (progressBar) {
        progressBar.style.width = `${stats.totalProgress}%`;
        progressBar.setAttribute('aria-valuenow', stats.totalProgress);
        
        const progressBadge = progressBar.parentElement.nextElementSibling;
        if (progressBadge) {
            progressBadge.textContent = `${stats.totalProgress}%`;
        }
    }

    // Update welcome message
    const welcomeMessage = document.querySelector('.card-body h3');
    if (welcomeMessage) {
        const userName = getUserName();
        welcomeMessage.textContent = `Bonjour, ${userName} ! 👋`;
    }

    const welcomeDescription = document.querySelector('.card-body p.text-muted');
    if (welcomeDescription) {
        welcomeDescription.textContent = `Vous avez ${stats.activeCourses} cours actifs et ${stats.pendingAssignments} devoirs à rendre.`;
    }
}

// Update recent courses
function updateRecentCourses(courses) {
    const coursesContainer = document.querySelector('.list-group.list-group-flush');
    if (!coursesContainer) return;

    if (courses.length === 0) {
        coursesContainer.innerHTML = '<div class="list-group-item text-center text-muted">Aucun cours en cours</div>';
        return;
    }

    coursesContainer.innerHTML = courses.map(course => `
        <a href="#" class="list-group-item list-group-item-action p-3 course-item">
            <div class="d-flex align-items-center">
                <div class="flex-shrink-0 me-3">
                    <img src="${course.thumbnail}" class="rounded" width="60" height="60" alt="Course">
                </div>
                <div class="flex-grow-1">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <span class="badge badge-${getCategoryClass(course.category)}">${course.category}</span>
                        <span class="text-muted small">${getInstructorName(course.instructor)}</span>
                    </div>
                    <h6 class="mb-1 fw-bold">${course.title}</h6>
                    <div class="d-flex justify-content-between align-items-center">
                        <div class="w-75">
                            <div class="progress course-progress mb-1">
                                <div class="progress-bar bg-success" role="progressbar" style="width: ${course.progress}%" aria-valuenow="${course.progress}" aria-valuemin="0" aria-valuemax="100"></div>
                            </div>
                            <span class="text-muted small">${course.progress}% complété</span>
                        </div>
                        <button class="btn btn-sm btn-primary">Continuer</button>
                    </div>
                </div>
            </div>
        </a>
    `).join('');
}

// Update recent quiz attempts
function updateRecentQuizAttempts(attempts) {
    // This would update a quiz attempts section if it exists
    console.log('Recent quiz attempts:', attempts);
}

// Update recent assignments
function updateRecentAssignments(assignments) {
    // This would update an assignments section if it exists
    console.log('Recent assignments:', assignments);
}

// Update upcoming deadlines
function updateUpcomingDeadlines(deadlines) {
    // This would update a deadlines section if it exists
    console.log('Upcoming deadlines:', deadlines);
}

// Update today's schedule with real data
function updateTodaySchedule(events) {
    const scheduleContainer = document.querySelector('.timeline');
    if (!scheduleContainer) return;

    if (events.length === 0) {
        scheduleContainer.innerHTML = `
            <div class="text-center text-muted py-3">
                <i class="fas fa-calendar-day fa-2x mb-2"></i>
                <p class="mb-0">Aucun événement prévu aujourd'hui</p>
            </div>
        `;
        return;
    }

    scheduleContainer.innerHTML = events.map(event => {
        const startTime = new Date(event.start).toLocaleTimeString('fr-FR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        const endTime = new Date(event.end).toLocaleTimeString('fr-FR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        return `
            <div class="timeline-item">
                <p class="mb-1 fw-medium">${startTime} - ${endTime}</p>
                <div class="card schedule-card p-2 mb-0">
                    <div class="d-flex align-items-center">
                        <span class="badge badge-${getCategoryClass(event.category)} me-2">${getCategoryLabel(event.category)}</span>
                        <div>
                            <p class="mb-0 fw-medium">${event.title}</p>
                            <p class="text-muted small mb-0">${event.courseTitle} - ${event.location}</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Get category label
function getCategoryLabel(category) {
    const labels = {
        'course': 'Cours',
        'practical': 'TP',
        'exam': 'Examen',
        'live': 'Live',
        'special': 'Spécial'
    };
    return labels[category] || 'Cours';
}

// Update user profile information
async function updateUserProfile() {
    try {
        const response = await fetch('/api/student/profile', {
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.message || 'Failed to load profile');
        }

        const student = data.student;
        
        // Update profile picture
        const profilePics = document.querySelectorAll('.avatar');
        profilePics.forEach(pic => {
            pic.src = student.profilePhoto || '../assets/images/default-profile.png';
        });

        // Update name in dropdown
        const nameElements = document.querySelectorAll('.fw-medium');
        nameElements.forEach(element => {
            if (element.textContent.includes('Marie Dupont')) {
                element.textContent = `${student.firstName} ${student.lastName}`;
            }
        });

    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

// Get user name from session or default
function getUserName() {
    // This would get the actual user name from session
    // For now, return a default
    return 'Marie';
}

// Get category class for styling
function getCategoryClass(category) {
    const categoryMap = {
        'Intelligence Artificielle': 'ai',
        'Développement Web': 'course',
        'Data Science': 'ai',
        'Marketing Digital': 'course',
        'Cybersécurité': 'ai',
        'Mobile': 'course',
        'Base de données': 'course'
    };
    return categoryMap[category] || 'course';
}

// Get instructor name
function getInstructorName(instructor) {
    if (typeof instructor === 'string') {
        return instructor;
    }
    return instructor?.firstName && instructor?.lastName ? 
        `${instructor.firstName} ${instructor.lastName}` : 'Instructeur';
}

// Setup event listeners
function setupEventListeners() {
    // Continue course buttons
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('btn-primary') && e.target.textContent === 'Continuer') {
            e.preventDefault();
            // Navigate to course page
            window.location.href = 'my-courses.html';
        }
    });

    // Logout button
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', function(e) {
            e.preventDefault();
            logout();
        });
    }
}

// Logout function
async function logout() {
    try {
        const response = await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include'
        });

        if (response.ok) {
            window.location.href = '../index.html';
        } else {
            showError('Erreur lors de la déconnexion');
        }
    } catch (error) {
        console.error('Logout error:', error);
        showError('Erreur lors de la déconnexion');
    }
}

// Show error message
function showError(message) {
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'error',
            title: 'Erreur',
            text: message
        });
    } else {
        alert(message);
    }
}

// Show success message
function showSuccess(message) {
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'success',
            title: 'Succès',
            text: message
        });
    } else {
        alert(message);
    }
} 