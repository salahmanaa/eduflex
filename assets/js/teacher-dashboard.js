// Teacher Dashboard Script
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
        return data.authenticated && data.user && data.user.role === 'teacher';
    } catch (error) {
        console.error('Auth check error:', error);
        return false;
    }
}

// Load dashboard statistics
async function loadDashboardData() {
    try {
        const response = await fetch('/api/teachers/dashboard/stats', {
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
        updatePendingGrading(data.stats.pendingGrading);
        updateStudentQuestions(data.stats.studentQuestions);
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

    const totalStudentsElement = document.querySelector('.card-stat .fas.fa-user-graduate').parentElement.querySelector('h3');
    if (totalStudentsElement) {
        totalStudentsElement.textContent = stats.totalStudents;
    }

    const pendingAssignmentsElement = document.querySelector('.card-stat .fas.fa-tasks').parentElement.querySelector('h3');
    if (pendingAssignmentsElement) {
        pendingAssignmentsElement.textContent = stats.pendingAssignments;
    }

    const teachingHoursElement = document.querySelector('.card-stat .fas.fa-clock').parentElement.querySelector('h3');
    if (teachingHoursElement) {
        teachingHoursElement.textContent = `${stats.teachingHours}h`;
    }

    // Update satisfaction progress bar
    const satisfactionBar = document.querySelector('.progress-bar.bg-success');
    if (satisfactionBar) {
        satisfactionBar.style.width = `${stats.averageSatisfaction}%`;
        satisfactionBar.setAttribute('aria-valuenow', stats.averageSatisfaction);
        
        const satisfactionBadge = satisfactionBar.parentElement.nextElementSibling;
        if (satisfactionBadge) {
            satisfactionBadge.textContent = `${stats.averageSatisfaction}%`;
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
        welcomeDescription.textContent = `Vous avez ${stats.pendingAssignments} soumissions de devoirs et ${stats.studentQuestions.length} questions d'étudiants à traiter.`;
    }
}

// Update recent courses
function updateRecentCourses(courses) {
    const coursesContainer = document.querySelector('.list-group.list-group-flush');
    if (!coursesContainer) return;

    if (courses.length === 0) {
        coursesContainer.innerHTML = '<div class="list-group-item text-center text-muted">Aucun cours actif</div>';
        return;
    }

    coursesContainer.innerHTML = courses.map(course => `
        <a href="#" class="list-group-item list-group-item-action p-3 course-item">
            <div class="d-flex align-items-center">
                <div class="flex-shrink-0 me-3">
                    <img src="${course.thumbnail || '/assets/images/default-course.png'}" class="rounded" width="60" height="60" alt="Course" onerror="this.onerror=null;this.src='/assets/images/default-course.png';">
                </div>
                <div class="flex-grow-1">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <span class="badge badge-${getCategoryClass(course.category)}">${course.category}</span>
                        <span class="text-muted small">${course.studentCount} étudiants</span>
                    </div>
                    <h6 class="mb-1 fw-bold">${course.title}</h6>
                    <div class="d-flex justify-content-between align-items-center">
                        <div class="d-flex align-items-center">
                            <div class="text-warning me-2">
                                ${generateStarRating(parseFloat(course.rating))}
                            </div>
                            <span class="text-muted small">${course.rating}/5 (${course.reviewCount} avis)</span>
                        </div>
                        <button class="btn btn-sm btn-primary">Gérer</button>
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

// Update pending grading
function updatePendingGrading(pendingGrading) {
    // This would update a pending grading section if it exists
    console.log('Pending grading:', pendingGrading);
}

// Update student questions with real forum data
function updateStudentQuestions(questions) {
    const questionsContainer = document.querySelector('.card-body .d-flex');
    if (!questionsContainer) return;

    if (questions.length === 0) {
        questionsContainer.innerHTML = `
            <div class="text-center text-muted py-3">
                <i class="fas fa-comments fa-2x mb-2"></i>
                <p class="mb-0">Aucune question récente</p>
            </div>
        `;
        return;
    }

    // Clear existing questions and add new ones
    const questionsSection = questionsContainer.parentElement;
    questionsSection.innerHTML = questions.map(question => `
        <div class="d-flex mb-3">
            <img src="../assets/images/default-profile.png" class="avatar me-3" alt="Student">
            <div class="flex-grow-1">
                <div class="d-flex align-items-center mb-1">
                    <p class="mb-0 fw-medium">${question.studentName}</p>
                    <span class="badge bg-primary-light text-primary ms-2">${question.course}</span>
                    ${question.isAnswered ? 
                        '<span class="badge bg-success ms-2"><i class="fas fa-check"></i> Répondu</span>' : 
                        '<span class="badge bg-warning ms-2"><i class="fas fa-clock"></i> En attente</span>'
                    }
                </div>
                <p class="small mb-1">${question.question}</p>
                <div class="d-flex align-items-center justify-content-between">
                    <p class="text-muted small mb-0">Il y a ${question.timeAgo}</p>
                    <div class="d-flex align-items-center">
                        <span class="text-muted small me-2">
                            <i class="fas fa-comments"></i> ${question.commentsCount}
                        </span>
                        <button class="btn btn-sm btn-outline-primary" onclick="viewQuestion('${question.id}')">
                            Voir
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// Function to view a specific question (can be expanded later)
function viewQuestion(questionId) {
    // Navigate to forum page with the specific question
    window.location.href = `forum.html?question=${questionId}`;
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
                            <p class="text-muted small mb-0">${event.courseTitle} - ${event.studentCount} étudiants</p>
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
        const response = await fetch('/api/teachers/profile', {
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

        const teacher = data.teacher;
        
        // Update profile picture
        const profilePics = document.querySelectorAll('.avatar');
        profilePics.forEach(pic => {
            pic.onerror = function() { this.onerror=null; this.src='/assets/images/default-profile.png'; };
            pic.src = teacher.profilePhoto || '/assets/images/default-profile.png';
        });

        // Update name in dropdown
        const nameElements = document.querySelectorAll('.fw-medium');
        nameElements.forEach(element => {
            if (element.textContent.includes('Prof. Laurent Martin')) {
                element.textContent = `Prof. ${teacher.firstName} ${teacher.lastName}`;
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
    return 'Prof. Laurent';
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

// Generate star rating HTML
function generateStarRating(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    let starsHTML = '';
    
    // Full stars
    for (let i = 0; i < fullStars; i++) {
        starsHTML += '<i class="fas fa-star small"></i>';
    }
    
    // Half star
    if (hasHalfStar) {
        starsHTML += '<i class="fas fa-star-half-alt small"></i>';
    }
    
    // Empty stars
    for (let i = 0; i < emptyStars; i++) {
        starsHTML += '<i class="far fa-star small"></i>';
    }
    
    return starsHTML;
}

// Setup event listeners
function setupEventListeners() {
    // Manage course buttons
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('btn-primary') && e.target.textContent === 'Gérer') {
            e.preventDefault();
            // Navigate to course management page
            window.location.href = 'mes-cours.html';
        }
    });

    // Answer questions button
    const answerQuestionsBtn = document.querySelector('.btn-primary.w-100');
    if (answerQuestionsBtn && answerQuestionsBtn.textContent === 'Répondre aux questions') {
        answerQuestionsBtn.addEventListener('click', function(e) {
            e.preventDefault();
            // Navigate to messages page
            window.location.href = 'messages.html';
        });
    }

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