// Global variables
let currentQuiz = null;
let currentAttempt = null;
let timerInterval = null;
let currentUserId = null;
let currentQuestionIndex = 0;
let lastQuizResults = null;

// Base API URL
const API_BASE_URL = '/api/student';
const AUTH_API_URL = '/api/auth';

// Check session and get user ID
async function checkSession() {
    try {
        const response = await fetch(`${AUTH_API_URL}/check`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Session check failed');
        }
        
        const data = await response.json();
        if (data.authenticated && data.userId) {
            currentUserId = data.userId;
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error checking session:', error);
        return false;
    }
}

// DOM Ready
document.addEventListener('DOMContentLoaded', async function() {
    // Check session and get user ID
    if (!await checkSession()) {
        console.error('User not authenticated');
        showError('Please log in again');
        return;
    }
    
    loadAvailableQuizzes();
    setupEventListeners();
    checkForActiveQuiz();
    attachQuizResultButtons();
});

// Event Listeners
function setupEventListeners() {
    // Start Quiz Button
    document.getElementById('startQuizBtn')?.addEventListener('click', startQuiz);
    
    // Submit Quiz Button
    document.getElementById('submitQuizBtn')?.addEventListener('click', submitQuiz);
    
    // Navigation buttons
    document.getElementById('nextQuestionBtn')?.addEventListener('click', nextQuestion);
    document.getElementById('prevQuestionBtn')?.addEventListener('click', prevQuestion);

    // Search quizzes
    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleSearch, 300));
    }
}

// Load available quizzes for the student
async function loadAvailableQuizzes(searchQuery = '') {
    try {
        const response = await fetch(`${API_BASE_URL}/quizzes?q=${encodeURIComponent(searchQuery)}`, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Failed to load quizzes (Status: ${response.status})`);
        }
        
        const data = await response.json();
        renderQuizzes(data.quizzes);
    } catch (error) {
        console.error('Error loading quizzes:', error);
        showError('Erreur lors du chargement des quiz. Veuillez réessayer.');
    }
}

// Render available quizzes
function renderQuizzes(quizzes) {
    const container = document.getElementById('quizzesContainer');
    if (!container) return;
    
    // Filter out unpublished quizzes
    const publishedQuizzes = quizzes.filter(quiz => quiz.status === 'published');
    
    if (!publishedQuizzes || publishedQuizzes.length === 0) {
        container.innerHTML = '<div class="alert alert-info">No available quizzes at the moment.</div>';
        return;
    }
    
    container.innerHTML = publishedQuizzes.map(quiz => {
        const statusClass = quiz.status === 'published' ? 'text-success' : 
                           quiz.status === 'draft' ? 'text-warning' : 'text-danger';
        const statusText = quiz.status === 'published' ? 'Published' : 
                          quiz.status === 'draft' ? 'Draft' : 'Archived';
        
        return `
            <div class="card mb-3">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <h5 class="card-title">${quiz.title}</h5>
                            <p class="card-text text-muted mb-2">${quiz.course?.name || 'No Course'}</p>
                            <p class="card-text">${quiz.description || 'No description available'}</p>
                            <div class="d-flex gap-2 mb-2">
                                <span class="badge bg-primary">${quiz.questions?.length || 0} Questions</span>
                                <span class="badge bg-secondary">${formatDuration(quiz.timeLimit)}</span>
                                <span class="badge ${statusClass}">${statusText}</span>
                            </div>
                        </div>
                        ${quiz.status === 'published' ? `
                            <button class="btn btn-primary start-quiz-btn" data-quiz-id="${quiz._id}">
                                Start Quiz
                            </button>
                        ` : `
                            <span class="text-muted">Not available</span>
                        `}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Add event listeners to start quiz buttons
    document.querySelectorAll('.start-quiz-btn').forEach(btn => {
        btn.addEventListener('click', () => confirmStartQuiz(btn.dataset.quizId));
    });
}

// Confirm before starting a quiz
function confirmStartQuiz(quizId) {
    Swal.fire({
        title: 'Start Quiz?',
        text: 'Make sure you are ready to begin. The timer will start as soon as you click Start.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Start Quiz',
        cancelButtonText: 'Cancel',
        reverseButtons: true
    }).then((result) => {
        if (result.isConfirmed) {
            startQuiz(quizId);
        }
    });
}

// Start a quiz
async function startQuiz(quizId) {
    try {
        console.log('Starting quiz with ID:', quizId);
        
        // Show loading state
        const startButton = document.querySelector(`button[data-quiz-id="${quizId}"]`);
        if (startButton) {
            startButton.disabled = true;
            startButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Chargement...';
        }
        
        console.log('Sending request to:', `${API_BASE_URL}/quiz/${quizId}/start`);
        
        const response = await fetch(`${API_BASE_URL}/quiz/${quizId}/start`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            credentials: 'include'
        });
        
        console.log('Response status:', response.status);
        
        const data = await response.json().catch(() => ({}));
        console.log('Response data:', data);
        
        if (!response.ok) {
            console.error('Failed to start quiz:', {
                status: response.status,
                statusText: response.statusText,
                data: data
            });
            
            let errorMessage = 'Échec du démarrage du quiz';
            if (response.status === 403) {
                errorMessage = data.message || 'Accès refusé';
            } else if (response.status === 404) {
                errorMessage = data.message || 'Quiz non trouvé';
                if (data.debug?.availableQuizIds) {
                    console.error('Available quiz IDs:', data.debug.availableQuizIds);
                }
            } else if (response.status === 401) {
                errorMessage = 'Session expirée. Veuillez vous reconnecter.';
            }
            
            throw new Error(errorMessage);
        }
        
        console.log('Quiz started successfully:', data);
        
        // Store quiz attempt ID
        currentAttempt = data.attempt;
        currentQuiz = data.quiz;
        
        // Show quiz interface
        showQuizInterface();
        
        // Start timer if quiz has time limit
        if (currentQuiz.timeLimit) {
            startTimer(currentQuiz.timeLimit * 60);
        }
        
    } catch (error) {
        console.error('Error starting quiz:', error);
        
        // Reset button state
        const startButton = document.querySelector(`button[data-quiz-id="${quizId}"]`);
        if (startButton) {
            startButton.disabled = false;
            startButton.innerHTML = 'Commencer le quiz';
        }
        
        // Show error to user
        Swal.fire({
            title: 'Erreur',
            text: error.message || 'Une erreur est survenue lors du démarrage du quiz',
            icon: 'error',
            confirmButtonText: 'OK'
        });
    }
}

// Show quiz interface
function showQuizInterface() {
    // Hide quizzes list
    document.getElementById('quizzesList').classList.add('d-none');
    
    // Show quiz container
    const quizContainer = document.getElementById('quizContainer');
    quizContainer.classList.remove('d-none');
    
    // Set quiz title
    document.getElementById('quizTitle').textContent = currentQuiz.title;
    
    // Render questions
    renderQuestions();

    // Reset and show first question
    currentQuestionIndex = 0;
    showQuestion(currentQuestionIndex);
    
    // Hide submit button initially
    document.getElementById('submitQuizBtn').style.display = 'none';

    // Update progress
    updateProgress();
}

// Render quiz questions
function renderQuestions() {
    const container = document.getElementById('quizQuestions');
    if (!container || !currentQuiz?.questions) return;
    
    container.innerHTML = currentQuiz.questions.map((question, index) => `
        <div class="question-card mb-4" id="question-${question._id}" style="display: none;">
            <div class="card">
                <div class="card-header">
                    <h6 class="mb-0">Question ${index + 1}</h6>
                </div>
                <div class="card-body">
                    <p class="card-text">${question.text}</p>
                    ${renderQuestionOptions(question)}
                </div>
            </div>
        </div>
    `).join('');
    
    // For radio/checkbox: go to next question or submit on change
    document.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(input => {
        input.addEventListener('change', function() {
            setTimeout(() => {
                if (currentQuiz.questions.length === 1 || currentQuestionIndex === currentQuiz.questions.length - 1) {
                    submitQuiz();
                } else {
                    nextQuestion();
                }
            }, 200);
        });
    });

    // For textarea (short answer): go to next or submit on Enter
    document.querySelectorAll('textarea').forEach(textarea => {
        textarea.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (currentQuiz.questions.length === 1 || currentQuestionIndex === currentQuiz.questions.length - 1) {
                    submitQuiz();
                } else {
                    nextQuestion();
                }
            }
        });
    });
}

// Render question options based on type
function renderQuestionOptions(question) {
    if (question.type === 'multiple_choice') {
        return question.options.map((option, i) => `
            <div class="form-check mb-2">
                <input class="form-check-input" type="radio"
                       name="question-${question._id}"
                       id="option-${question._id}-${i}"
                       value="${i}">
                <label class="form-check-label" for="option-${question._id}-${i}">
                    ${option}
                </label>
            </div>
        `).join('');
    } else if (question.type === 'true_false') {
        // Always render two options: true and false
        return [true, false].map((val, i) => `
            <div class="form-check mb-2">
                <input class="form-check-input" type="radio"
                       name="question-${question._id}"
                       id="option-${question._id}-${i}"
                       value="${val}">
                <label class="form-check-label" for="option-${question._id}-${i}">
                    ${val ? 'Vrai' : 'Faux'}
                </label>
            </div>
        `).join('');
    } else if (question.type === 'checkbox') {
        return question.options.map((option, i) => `
            <div class="form-check mb-2">
                <input class="form-check-input" type="checkbox" 
                       name="question-${question._id}" 
                       id="option-${question._id}-${i}" 
                       value="${i}">
                <label class="form-check-label" for="option-${question._id}-${i}">
                    ${option}
                </label>
            </div>
        `).join('');
    } else if (question.type === 'short_answer') {
        return `
            <div class="mb-3">
                <textarea class="form-control" id="answer-${question._id}" rows="2"></textarea>
            </div>
        `;
    }
    return '';
}

// Update progress bar and question navigation
function updateProgress() {
    if (!currentQuiz?.questions) return;

    const totalQuestions = currentQuiz.questions.length;
    let answeredQuestions = 0;

    currentQuiz.questions.forEach((question, index) => {
        const questionCard = document.getElementById(`question-${question._id}`);
        if (!questionCard) return;

        if (question.type === 'multiple_choice' || question.type === 'true_false') {
            const answered = questionCard.querySelector(`input[name="question-${question._id}"]:checked`);
            if (answered) {
                answeredQuestions++;
            }
        } else if (question.type === 'checkbox') {
            // Considered answered if at least one checkbox is checked
            const answered = questionCard.querySelector(`input[name="question-${question._id}"]:checked`);
            if (answered) {
                answeredQuestions++;
            }
        } else if (question.type === 'short_answer') {
            const textarea = questionCard.querySelector('textarea');
            if (textarea && textarea.value.trim() !== '') {
                answeredQuestions++;
            }
        }
    });

    const progress = totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0;
    
    // Update progress bar
    const progressBar = document.getElementById('quizProgress');
    if (progressBar) {
        progressBar.style.width = `${progress}%`;
        progressBar.setAttribute('aria-valuenow', progress);
    }
    
    // Update progress text
    const progressText = document.getElementById('progressText');
    if (progressText) {
        progressText.textContent = `Question ${currentQuestionIndex + 1} de ${totalQuestions} (${answeredQuestions} répondues)`;
    }
}

// Start the quiz timer
function startTimer(durationInSeconds) {
    let timeLeft = durationInSeconds;
    const timerElement = document.getElementById('quizTimer');
    
    if (!timerElement) return;
    
    // Clear any existing timer
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    
    // Update timer immediately
    updateTimerDisplay(timerElement, timeLeft);
    
    // Update timer every second
    timerInterval = setInterval(() => {
        timeLeft--;
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            handleTimeExpired();
            return;
        }
        
        updateTimerDisplay(timerElement, timeLeft);
    }, 1000);
}

// Update the timer display
function updateTimerDisplay(element, seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    element.textContent = `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
    
    // Change color when time is running low
    if (seconds < 60) {
        element.classList.add('text-danger');
        element.classList.add('fw-bold');
    } else if (seconds < 300) { // 5 minutes
        element.classList.add('text-warning');
    }
}

// Handle when time expires
function handleTimeExpired() {
    // Auto-submit the quiz
    submitQuiz();
    
    // Show time's up message
    Swal.fire({
        title: 'Time\'s Up!',
        text: 'Your quiz has been automatically submitted.',
        icon: 'info',
        confirmButtonText: 'OK'
    });
}

// Submit the quiz
async function submitQuiz() {
    if (!currentQuiz || !currentAttempt) return;
    
    try {
        // Collect all answers
        const answers = collectAnswers();
        
        // Submit answers
        const response = await fetch(`${API_BASE_URL}/quiz-attempt/${currentAttempt._id}/submit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ answers })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Failed to submit quiz (Status: ${response.status})`);
        }
        
        const data = await response.json();
        
        // Show results
        showQuizResults(data.results);
        
    } catch (error) {
        console.error('Error submitting quiz:', error);
        showError(error.message || 'Failed to submit quiz');
    } finally {
        // Clean up
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        currentQuiz = null;
        currentAttempt = null;
    }
}

// Collect all answers from the form
function collectAnswers() {
    const answers = [];
    if (!currentQuiz || !currentQuiz.questions) return answers;

    currentQuiz.questions.forEach((question, index) => {
        const answer = { questionId: question._id };

        if (question.type === 'multiple_choice') {
            // Single choice, store index as number
            const selectedInput = document.querySelector(`input[name="question-${question._id}"]:checked`);
            if (selectedInput) {
                answer.selectedOptions = [parseInt(selectedInput.value, 10)];
            } else {
                answer.selectedOptions = [];
            }
        } else if (question.type === 'true_false') {
            // True/false, store value as boolean
            const selectedInput = document.querySelector(`input[name="question-${question._id}"]:checked`);
            if (selectedInput) {
                // Accept 'true'/'false' or '1'/'0' as value
                let val = selectedInput.value;
                if (val === 'true' || val === '1') val = true;
                else if (val === 'false' || val === '0') val = false;
                answer.selectedOptions = [val];
            } else {
                answer.selectedOptions = [];
            }
        } else if (question.type === 'checkbox') {
            // Multiple selection, store indices as numbers
            const selectedInputs = document.querySelectorAll(`input[name="question-${question._id}"]:checked`);
            answer.selectedOptions = Array.from(selectedInputs).map(input => parseInt(input.value, 10));
        } else if (question.type === 'short_answer' || question.type === 'open_ended') {
            // Text answer
            const textarea = document.getElementById(`answer-${question._id}`);
            answer.textAnswer = textarea ? textarea.value.trim() : "";
        }
        answers.push(answer);
    });
    return answers;
}

// Show quiz results
function showQuizResults(results) {
    lastQuizResults = results; // Store for review
    // Hide quiz container
    document.getElementById('quizContainer').classList.add('d-none');
    
    // Show results container
    const resultsContainer = document.getElementById('quizResults');
    resultsContainer.classList.remove('d-none');
    
    // Display score
    const scoreElement = document.getElementById('quizScore');
    if (scoreElement) {
        // Prefer points if available, else fallback to old style
        if (typeof results.totalPoints === 'number' && typeof results.maxPoints === 'number') {
            scoreElement.textContent = `${results.totalPoints} / ${results.maxPoints} pts`;
            const percentage = results.maxPoints > 0 ? Math.round((results.totalPoints / results.maxPoints) * 100) : 0;
            if (percentage >= 70) {
                scoreElement.classList.add('text-success');
            } else if (percentage >= 50) {
                scoreElement.classList.add('text-warning');
            } else {
                scoreElement.classList.add('text-danger');
            }
        } else {
            const percentage = Math.round((results.score / results.totalQuestions) * 100);
            scoreElement.textContent = `${results.score} / ${results.totalQuestions} (${percentage}%)`;
            if (percentage >= 70) {
                scoreElement.classList.add('text-success');
            } else if (percentage >= 50) {
                scoreElement.classList.add('text-warning');
            } else {
                scoreElement.classList.add('text-danger');
            }
        }
    }
    
    // Display feedback
    const feedbackElement = document.getElementById('quizFeedback');
    if (feedbackElement) {
        if (results.feedback) {
            feedbackElement.textContent = results.feedback;
        } else if (typeof results.passed === 'boolean') {
            feedbackElement.textContent = results.passed ? 'Félicitations ! Vous avez réussi le quiz.' : 'Vous n\'avez pas réussi le quiz. Veuillez réviser le cours et réessayer.';
        } else {
            feedbackElement.textContent = 'Merci d\'avoir complété le quiz !';
        }
    }
    
    // Display detailed results if available
    renderQuizReview(results);

    // Always re-attach review/retake button handlers after rendering
    attachQuizResultButtons();
}

function renderQuizReview(results) {
    const detailsElement = document.getElementById('quizDetails');
    const details = results.detailedResults || results.details;
    if (detailsElement && Array.isArray(details)) {
        detailsElement.innerHTML = details.map(detail => `
            <div class="card mb-2 ${detail.isCorrect ? 'border-success' : 'border-danger'}">
                <div class="card-body p-2">
                    <h6 class="card-title">${detail.questionText || detail.question || ''}</h6>
                    <p class="mb-1"><strong>Votre réponse :</strong> ${detail.studentAnswer || detail.userAnswer || 'Aucune réponse'}</p>
                    ${detail.isCorrect ? '' : `<p class=\"mb-0\"><strong>Bonne réponse :</strong> ${detail.correctAnswer || ''}</p>`}
                    <p class="mb-0"><strong>Points :</strong> ${typeof detail.earnedPoints === 'number' ? detail.earnedPoints : ''} / ${typeof detail.points === 'number' ? detail.points : ''}</p>
                    ${detail.explanation ? `<p class=\"mb-0\"><em>${detail.explanation}</em></p>` : ''}
                </div>
            </div>
        `).join('');
    }
}

// Handle search
function handleSearch(e) {
    const query = e.target.value.trim();
    loadAvailableQuizzes(query);
}

// Debounce function to limit API calls during search
function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

// Format duration in minutes to HH:MM:SS
function formatDuration(minutes) {
    if (minutes === 0 || !minutes) return 'No time limit';
    return `${minutes} min`;
}

// Show error message
function showError(message) {
    Swal.fire({
        title: 'Error',
        text: message,
        icon: 'error',
        confirmButtonText: 'OK'
    });
}

// Check for active quiz on page load
async function checkForActiveQuiz() {
    try {
        const response = await fetch(`${API_BASE_URL}/quiz/active`, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Failed to check active quiz (Status: ${response.status})`);
        }
        
        const data = await response.json();
        
        if (data.active) {
            // Show a prompt to continue the active quiz
            const result = await Swal.fire({
                title: 'Quiz en cours',
                text: 'Vous avez un quiz en cours. Voulez-vous continuer ?',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Continuer le quiz',
                cancelButtonText: 'Commencer un nouveau',
                reverseButtons: true
            });
            
            if (result.isConfirmed) {
                // Load the active quiz
                currentQuiz = data.quiz;
                currentAttempt = data.attempt;
                showQuizInterface();
                
                // Start timer with remaining time
                startTimer(data.attempt.timeRemaining);
            } else {
                // Abandon the active quiz
                await fetch(`${API_BASE_URL}/quiz-attempt/${data.attempt._id}/abandon`, { 
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    }
                });
            }
        }
    } catch (error) {
        console.error('Error checking for active quiz:', error);
        // Don't show error to user, just log it
    }
}

// Navigation functions
function nextQuestion() {
    if (currentQuiz && currentQuiz.questions && currentQuestionIndex < currentQuiz.questions.length - 1) {
        currentQuestionIndex++;
        showQuestion(currentQuestionIndex);
    }
}

function prevQuestion() {
    if (currentQuiz && currentQuiz.questions && currentQuestionIndex > 0) {
        currentQuestionIndex--;
        showQuestion(currentQuestionIndex);
    }
}

function showQuestion(index) {
    if (!currentQuiz || !currentQuiz.questions) return;
    const questions = document.querySelectorAll('.question-card');
    questions.forEach((question, i) => {
        question.style.display = i === index ? 'block' : 'none';
    });
    currentQuestionIndex = index;

    // Update button states
    const prevBtn = document.getElementById('prevQuestionBtn');
    const nextBtn = document.getElementById('nextQuestionBtn');
    const submitBtn = document.getElementById('submitQuizBtn');

    if (prevBtn) prevBtn.disabled = index === 0;
    if (nextBtn) nextBtn.style.display = index === (currentQuiz && currentQuiz.questions ? currentQuiz.questions.length - 1 : 0) ? 'none' : 'block';
    if (submitBtn) submitBtn.style.display = index === (currentQuiz && currentQuiz.questions ? currentQuiz.questions.length - 1 : 0) ? 'block' : 'none';

    updateProgress();
}

// Ensure review/retake button handlers are always attached
function attachQuizResultButtons() {
    const reviewBtn = document.getElementById('reviewQuizBtn');
    const retakeBtn = document.getElementById('retakeQuizBtn');
    if (reviewBtn) {
        reviewBtn.onclick = function(e) {
            e.preventDefault();
            console.log('Review button clicked', lastQuizResults);
            if (lastQuizResults) {
                renderQuizReview(lastQuizResults);
                document.getElementById('quizResults').classList.remove('d-none');
                document.getElementById('quizDetails').scrollIntoView({ behavior: 'smooth' });
            }
        };
    }
    if (retakeBtn && lastQuizResults) {
        if (lastQuizResults.passed) {
            retakeBtn.style.display = 'none';
        } else {
            retakeBtn.style.display = 'inline-block';
            retakeBtn.onclick = function(e) {
                e.preventDefault();
                if (window.currentQuiz && window.currentQuiz._id) {
                    startQuiz(window.currentQuiz._id);
                } else {
                    window.location.reload();
                }
            };
        }
    }
}