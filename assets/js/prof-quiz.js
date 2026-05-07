let currentQuizId = null;
let quizzes = [];
let courses = [];

document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    loadInitialData();
});

function setupEventListeners() {
    const addQuestionForm = document.getElementById('addQuestionForm');
    const questionTypeSelect = document.getElementById('questionType');
    const mcOptionsContainer = document.getElementById('mcOptionsContainer');
    
    if (addQuestionForm) {
        addQuestionForm.addEventListener('submit', addQuestion);
    }
    
    document.getElementById('editQuestionForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        updateQuestion();
    });
    
    if (questionTypeSelect) {
        // Initialize the form based on the default selected type
        toggleMcOptions(questionTypeSelect.value, mcOptionsContainer);
        
        // Add change event listener
        questionTypeSelect.addEventListener('change', (e) => {
            toggleMcOptions(e.target.value, mcOptionsContainer);
        });
    }
    
    document.getElementById('addOptionBtn')?.addEventListener('click', () => addOption('options-wrapper'));
    document.getElementById('editAddOptionBtn')?.addEventListener('click', () => addOption('edit-options-wrapper', true));
    document.getElementById('searchQuiz')?.addEventListener('input', filterQuizzes);
    document.getElementById('filterCourse')?.addEventListener('change', filterQuizzes);
    document.getElementById('filterStatus')?.addEventListener('change', filterQuizzes);
    document.getElementById('sortBy')?.addEventListener('change', filterQuizzes);
    document.getElementById('publishQuizBtn')?.addEventListener('click', () => currentQuizId && publishQuiz(currentQuizId));
    document.getElementById('createQuizBtn')?.addEventListener('click', createQuiz);
    document.getElementById('updateQuestionBtn')?.addEventListener('click', updateQuestion);
    document.getElementById('editQuestionType')?.addEventListener('change', (e) => toggleMcOptions(e.target.value, document.getElementById('editMcOptionsContainer')));
}

async function loadInitialData() {
    await loadCourses();
    await loadQuizzes();
    toggleMcOptions('multiple_choice', document.getElementById('mcOptionsContainer'));
}

async function loadCourses() {
    try {
        const response = await fetch('/api/teacher/courses');
        const data = await response.json();
        if (!data.success) throw new Error(data.message);
        courses = data.courses;
        const courseSelects = ['quizCourse', 'filterCourse'];
        courseSelects.forEach(selectId => {
            const select = document.getElementById(selectId);
            select.innerHTML = selectId === 'filterCourse' ? '<option value="">Tous les cours</option>' : '<option value="">Sélectionnez un cours</option>';
            courses.forEach(course => {
                select.innerHTML += `<option value="${course._id}">${course.title}</option>`;
            });
        });
    } catch (error) {
        console.error('Error loading courses:', error);
        Swal.fire('Erreur', 'Impossible de charger les cours.', 'error');
    }
}

async function loadQuizzes() {
    try {
        const response = await fetch('/api/teacher/quizzes');
        const data = await response.json();
        if (!data.success) throw new Error(data.message);
        quizzes = data.quizzes;
        displayQuizzes(quizzes);
    } catch (error) {
        console.error('Error loading quizzes:', error);
        Swal.fire('Erreur', 'Impossible de charger les quiz.', 'error');
    }
}

async function publishQuiz(quizId) {
    const result = await Swal.fire({
        title: 'Êtes-vous sûr?',
        text: "Voulez-vous publier ce quiz? Il sera visible par les étudiants.",
        icon: 'info',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Oui, publier!',
        cancelButtonText: 'Annuler'
    });

    if (result.isConfirmed) {
        try {
            const response = await fetch(`/api/teacher/quiz/${quizId}/publish`, { 
                method: 'PUT' 
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Erreur lors de la publication');
            }

            Swal.fire(
                'Publié!',
                'Le quiz a été publié avec succès.',
                'success'
            );

            // Refresh the quiz list to show the updated status
            loadQuizzes();
        } catch (error) {
            console.error('Publish quiz error:', error);
            Swal.fire(
                'Erreur',
                error.message,
                'error'
            );
        }
    }
}

function displayQuizzes(quizzesToShow) {
    const container = document.getElementById('quizContainer');
    if (quizzesToShow.length === 0) {
        container.innerHTML = `<div class="col-12 text-center py-5"><i class="fas fa-question-circle fa-3x text-muted mb-3"></i><h4>Aucun quiz trouvé</h4><p class="text-muted">Créez votre premier quiz pour commencer</p></div>`;
        return;
    }
    container.innerHTML = quizzesToShow.map(quiz => {
        const course = courses.find(c => c._id === quiz.courseId) || { title: 'N/A' };
        
        // Calculate participants statistics
        const participantCount = quiz.participants?.length || 0;
        let averageScore = 0;
        
        if (participantCount > 0) {
            const totalScores = quiz.participants.reduce((sum, p) => sum + (p.score || 0), 0);
            averageScore = Math.round(totalScores / participantCount);
        }
        
        return `
        <div class="col-md-6">
            <div class="card quiz-card">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <span class="badge bg-primary">${course.title}</span>
                        <span class="badge ${'badge-' + quiz.status}">${getStatusText(quiz.status)}</span>
                    </div>
                    <h5 class="card-title fw-bold mb-2">${quiz.title}</h5>
                    <p class="text-muted mb-3">${quiz.description || 'Aucune description'}</p>
                    <div class="d-flex justify-content-between text-muted small mb-3">
                        <span><i class="fas fa-question me-2"></i>${quiz.questions.length} questions</span>
                        <span><i class="fas fa-clock me-2"></i>${quiz.duration} min</span>
                        <span><i class="fas fa-calendar me-2"></i>${formatDate(quiz.startDate)}</span>
                    </div>
                    <div class="d-flex justify-content-between text-muted small mb-3">
                        <span><i class="fas fa-users me-2"></i>${participantCount} participants</span>
                        <span><i class="fas fa-chart-line me-2"></i>${averageScore}% moyenne</span>
                    </div>
                    <div class="d-flex justify-content-between">
                        <button class="btn btn-primary" onclick="manageQuiz('${quiz._id}')">${quiz.status === 'draft' ? 'Gérer' : 'Voir détails'}</button>
                        <div class="dropdown">
                            <button class="btn btn-light" data-bs-toggle="dropdown"><i class="fas fa-ellipsis-v"></i></button>
                            <ul class="dropdown-menu dropdown-menu-end">
                                <li><a class="dropdown-item" href="#" onclick="manageQuiz('${quiz._id}')"><i class="fas fa-edit me-2"></i>Gérer</a></li>
                                <li><a class="dropdown-item text-danger" href="#" onclick="deleteQuiz('${quiz._id}')"><i class="fas fa-trash-alt me-2"></i>Supprimer</a></li>
                                ${quiz.status === 'draft' ? `<li><hr class="dropdown-divider"></li><li><a class="dropdown-item text-success" href="#" onclick="publishQuiz('${quiz._id}')"><i class="fas fa-paper-plane me-2"></i>Publier</a></li>` : ''}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');
}

async function createQuiz() {
    const form = document.getElementById('newQuizForm');
    if (!form.checkValidity()) return form.reportValidity();
    const quizData = {
        title: form.elements.quizTitle.value,
        description: form.elements.quizDescription.value,
        courseId: form.elements.quizCourse.value,
        duration: parseInt(form.elements.quizDuration.value),
        points: parseInt(form.elements.quizPoints.value) || 0,
        startDate: form.elements.quizStartDate.value,
        shuffleQuestions: form.elements.shuffleQuestions.checked,
        showResults: form.elements.showResults.checked
    };
    try {
        const response = await fetch('/api/teacher/quizzes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(quizData) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        Swal.fire('Succès', 'Quiz créé avec succès!', 'success');
        bootstrap.Modal.getInstance(document.getElementById('newQuizModal')).hide();
        form.reset();
        loadQuizzes();
    } catch (error) {
        Swal.fire('Erreur', error.message, 'error');
    }
}

async function manageQuiz(quizId) {
    currentQuizId = quizId;
    try {
        const response = await fetch(`/api/teacher/quiz/${quizId}`);
        const data = await response.json();
        if (!data.success) throw new Error(data.message);
        document.getElementById('quizManageTitle').textContent = `Gérer: ${data.quiz.title}`;
        loadQuestions(quizId);
        new bootstrap.Modal(document.getElementById('quizManageModal')).show();
    } catch (error) {
        Swal.fire('Erreur', 'Impossible de charger le quiz.', 'error');
    }
}

async function deleteQuiz(quizId) {
    const result = await Swal.fire({ title: 'Êtes-vous sûr?', text: "Cette action est irréversible!", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Oui, supprimer!' });
    if (result.isConfirmed) {
        try {
            const response = await fetch(`/api/teacher/quiz/${quizId}`, { method: 'DELETE' });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message);
            Swal.fire('Supprimé!', 'Le quiz a été supprimé.', 'success');
            loadQuizzes();
        } catch (error) {
            Swal.fire('Erreur', error.message, 'error');
        }
    }
}

async function loadQuestions(quizId) {
    try {
        const response = await fetch(`/api/teacher/quiz/${quizId}`);
        const data = await response.json();
        const container = document.getElementById('questionsList');
        
        if (!data.success || !data.quiz.questions || data.quiz.questions.length === 0) {
            container.innerHTML = `<div class="text-center py-4"><p class="text-muted">Aucune question ajoutée</p></div>`;
            return;
        }
        
        container.innerHTML = data.quiz.questions.map((q, i) => renderQuestion(q, i)).join('');
    } catch (error) {
        console.error('Error loading questions:', error);
        document.getElementById('questionsList').innerHTML = `<div class="text-center py-4"><p class="text-danger">Erreur lors du chargement des questions</p></div>`;
    }
}

// FIX: Fonction renderQuestion corrigée
function renderQuestion(question, index) {
    let optionsHtml = '';
    
    if (question.type === 'multiple_choice') {
        optionsHtml = '<ul class="list-unstyled">';
        question.options.forEach(opt => {
            optionsHtml += `<li>
                <i class="far ${opt.isCorrect ? 'fa-check-circle text-success' : 'fa-circle'} me-2"></i>
                ${opt.text}
            </li>`;
        });
        optionsHtml += '</ul>';
    
    } else {
       
        let answerDisplay = '';
        if (question.type === 'true_false') {
            
            answerDisplay = question.correctAnswer === true ? 'Vrai' : 'Faux';
        } 
         else {
            answerDisplay = question.correctAnswer || '';
        }
        optionsHtml = `<p class="mb-0"><strong>Réponse:</strong> ${answerDisplay}</p>`;
    }
    
    return `
    <div class="question-item">
        <div class="d-flex justify-content-between align-items-start mb-2">
            <h6 class="mb-0">Question ${index + 1} 
                <span class="badge bg-secondary">${getQuestionTypeText(question.type)}</span>
                <span class="badge bg-info">${question.points || 1} pts</span> 
            </h6>
            <div>
                <button class="btn btn-sm btn-outline-primary me-1" onclick="editQuestion('${question._id}')"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteQuestion('${question._id}')"><i class="fas fa-trash"></i></button>
            </div>
        </div>
        <p class="fw-bold mb-1">${index + 1}. ${question.questionText}</p>
        ${optionsHtml}
        ${question.explanation ? `<small class="text-muted">Explication: ${question.explanation}</small>` : ''}
    </div>`;
}

// FIX: Fonction addQuestion corrigée
async function addQuestion(e) {
    e.preventDefault();
    e.stopPropagation(); // Prevent any further event propagation
    
    const form = e.target;
    const questionType = form.elements.questionType.value;
    
    // Remove the required attribute from all inputs to prevent HTML5 validation
    form.querySelectorAll('[required]').forEach(input => {
        input.required = false;
    });

    const questionData = {
        quizId: currentQuizId,
        type: questionType,
        questionText: form.elements.questionText.value.trim(),
        explanation: form.elements.questionExplanation.value.trim(),
        points: parseInt(form.elements.questionPoints.value) || 1
    };

    // Validation du texte de la question
    if (!questionData.questionText) {
        return Swal.fire('Erreur', 'Le texte de la question est requis.', 'error');
    }

    if (questionType === 'multiple_choice') {
        // Get all option inputs and their values
        const optionInputs = Array.from(form.querySelectorAll('[name="optiontext"]'));
        const options = [];
        let hasCorrectAnswer = false;
        
        // Process each option input
        optionInputs.forEach((input, index) => {
            const text = input.value.trim();
            if (!text) return; // Skip empty options
            
            // Check if this is the correct answer
            const isChecked = form.querySelector(`[name="correctoption"][value="${index}"]:checked`) !== null;
            if (isChecked) hasCorrectAnswer = true;
            
            options.push({
                text: text,
                isCorrect: isChecked
            });
        });
        
        // Validate options
        if (options.length < 2) {
            return Swal.fire('Erreur', 'Veuillez ajouter au moins deux options pour une question à choix multiple.', 'error');
        }
        
        if (!hasCorrectAnswer) {
            return Swal.fire('Erreur', 'Veuillez sélectionner une réponse correcte.', 'error');
        }
        
        questionData.options = options;
    } else if (questionType === 'true_false') {
        const correctAnswerText = form.elements.correctAnswer.value.trim().toLowerCase();
        if (!['vrai', 'faux', 'true', 'false'].includes(correctAnswerText)) {
            return Swal.fire('Erreur', 'Veuillez entrer "Vrai" ou "Faux" pour la réponse correcte.', 'error');
        }
        questionData.correctAnswer = correctAnswerText === 'vrai' || correctAnswerText === 'true';
    } else if (questionType === 'open_ended') {
        questionData.correctAnswer = form.elements.correctAnswer.value.trim();
        if (!questionData.correctAnswer) {
            return Swal.fire('Erreur', 'Veuillez fournir une réponse modèle pour la question ouverte.', 'error');
        }
    }

    try {
        console.log('Sending question data:', JSON.stringify(questionData, null, 2));
        
        const response = await fetch(`/api/teacher/quiz/${currentQuizId}/question`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(questionData)
        });
        
        const data = await response.json().catch(err => {
            console.error('Error parsing JSON response:', err);
            throw new Error('Invalid response from server');
        });
        
        console.log('Server response:', data);
        
        if (!response.ok) {
            console.error('Server responded with error:', data);
            
            // Handle validation errors
            if (data.errors) {
                let errorMessages = [];
                // Handle both string errors and error objects
                Object.entries(data.errors).forEach(([field, error]) => {
                    if (typeof error === 'string') {
                        errorMessages.push(`${field}: ${error}`);
                    } else if (error && error.message) {
                        errorMessages.push(`${field}: ${error.message}`);
                    } else {
                        errorMessages.push(`${field}: ${JSON.stringify(error)}`);
                    }
                });
                
                if (errorMessages.length === 0 && data.validationError) {
                    errorMessages.push(data.validationError);
                }
                
                throw new Error(`Erreur de validation :\n${errorMessages.join('\n')}`);
            }
            
            // Handle other types of errors
            const errorMessage = data.message || 
                              data.validationError || 
                              (data.error ? JSON.stringify(data.error) : 'Erreur inconnue du serveur');
            throw new Error(errorMessage);
        }
        
        Swal.fire('Succès', 'Question ajoutée!', 'success');
        form.reset();
        // Reset options container
        const optionsWrapper = document.getElementById('options-wrapper');
        optionsWrapper.innerHTML = `
            <div class="input-group mb-2">
                <div class="input-group-text">
                    <input class="form-check-input mt-0" type="radio" name="correctoption" value="0">
                </div>
                <input type="text" class="form-control" name="optiontext" placeholder="Option 1">
            </div>
            <div class="input-group mb-2">
                <div class="input-group-text">
                    <input class="form-check-input mt-0" type="radio" name="correctoption" value="1">
                </div>
                <input type="text" class="form-control" name="optiontext" placeholder="Option 2">
            </div>
        `;
        toggleMcOptions('multiple_choice', document.getElementById('mcOptionsContainer'));
        loadQuestions(currentQuizId);
    } catch (error) {
        console.error('Add question error:', error);
        Swal.fire('Erreur', error.message, 'error');
    }
}

// FIX: Fonction editQuestion corrigée
async function editQuestion(questionId) {
    try {
        console.log('Fetching question with ID:', questionId);
        const response = await fetch(`/api/teacher/questions/${questionId}`);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('Error response:', response.status, errorData);
            throw new Error(errorData.message || `Erreur ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Question data received:', data);
        
        const question = data.question;
        const form = document.getElementById('editQuestionForm');
        
        // Remplir le formulaire
        form.elements.editQuestionId.value = question._id;
        form.elements.editQuestionText.value = question.questionText;
        form.elements.editQuestionType.value = question.type;
        form.elements.editQuestionExplanation.value = question.explanation || '';
        form.elements.editQuestionPoints.value = question.points || 1;
        
        // Gestion du type
        toggleMcOptions(question.type, document.getElementById('editMcOptionsContainer'));
        
        // Options pour MCQ
        const optionsWrapper = document.getElementById('edit-options-wrapper');
        optionsWrapper.innerHTML = '';
        
        if (question.type === 'multiple_choice' && question.options) {
            question.options.forEach((option, index) => {
                const optionDiv = document.createElement('div');
                optionDiv.className = 'input-group mb-2';
                optionDiv.innerHTML = `
                    <div class="input-group-text">
                        <input class="form-check-input mt-0" 
                               type="radio" 
                               name="editcorrectoption" 
                               value="${index}"
                               ${option.isCorrect ? 'checked' : ''}>
                    </div>
                    <input type="text" 
                           class="form-control" 
                           name="editoptiontext" 
                           value="${option.text || ''}">
                `;
                optionsWrapper.appendChild(optionDiv);
            });
        } 
        else {
            if (question.type === 'true_false') {
                form.elements.editCorrectAnswer.value = question.correctAnswer ? 'Vrai' : 'Faux';
            } else {
                form.elements.editCorrectAnswer.value = question.correctAnswer || '';
            }
        }
        
        // Afficher le modal
        const modal = new bootstrap.Modal(document.getElementById('editQuestionModal'));
        modal.show();
    } catch (error) {
        Swal.fire('Erreur', `Impossible de charger la question: ${error.message}`, 'error');
    }
}

// FIX: Fonction updateQuestion corrigée
async function updateQuestion() {
    const form = document.getElementById('editQuestionForm');
    const questionId = form.elements.editQuestionId.value;
    const questionType = form.elements.editQuestionType.value;

    // Show loading state
    const updateBtn = document.getElementById('updateQuestionBtn');
    const originalBtnText = updateBtn.innerHTML;
    updateBtn.disabled = true;
    updateBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Mise à jour...';

    try {
        // Préparer les données
        const questionData = {
            type: questionType,
            questionText: form.elements.editQuestionText.value.trim(),
            explanation: form.elements.editQuestionExplanation.value.trim(),
            points: parseInt(form.elements.editQuestionPoints.value) || 1
        };

        // Gestion spécifique par type
        if (questionType === 'multiple_choice') {
            const options = [];
            const optionInputs = document.querySelectorAll('#edit-options-wrapper [name="editoptiontext"]');
            const correctRadios = document.querySelectorAll('#edit-options-wrapper [name="editcorrectoption"]');
            
            // Validation
            let hasEmptyOption = false;
            let hasCorrect = false;
            
            optionInputs.forEach((input, index) => {
                const text = input.value.trim();
                const isCorrect = correctRadios[index].checked;
                
                if (!text) hasEmptyOption = true;
                if (isCorrect) hasCorrect = true;
                
                options.push({
                    text,
                    isCorrect
                });
            });
            
            if (hasEmptyOption) {
                throw new Error('Toutes les options doivent être remplies');
            }
            
            if (!hasCorrect) {
                throw new Error('Sélectionnez une réponse correcte');
            }
            
            questionData.options = options;
        } 
        else {
            let correctAnswer = form.elements.editCorrectAnswer.value;
            
            if (questionType === 'true_false') {
                correctAnswer = correctAnswer.trim().toLowerCase() === 'vrai';
            }
            else if (questionType === 'open_ended' && !correctAnswer.trim()) {
                throw new Error('La réponse ne peut pas être vide');
            }
            
            questionData.correctAnswer = correctAnswer;
        }

        console.log('Sending update request:', { questionId, questionData });

        const response = await fetch(`/api/teacher/questions/${questionId}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(questionData)
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Erreur lors de la mise à jour de la question');
        }
        
        // Show success message
        await Swal.fire({
            icon: 'success',
            title: 'Succès',
            text: 'Question mise à jour avec succès',
            timer: 1500,
            showConfirmButton: false
        });

        // Close the modal and refresh the questions list
        const modal = bootstrap.Modal.getInstance(document.getElementById('editQuestionModal'));
        if (modal) modal.hide();
        
        // Refresh the questions list
        loadQuestions(currentQuizId);
        
    } catch (error) {
        console.error('Update question error:', error);
        Swal.fire({
            icon: 'error',
            title: 'Erreur',
            text: error.message || 'Une erreur est survenue lors de la mise à jour de la question',
            confirmButtonText: 'OK'
        });
    } finally {
        // Reset button state
        updateBtn.disabled = false;
        updateBtn.innerHTML = originalBtnText;
    }
}

async function deleteQuestion(questionId) {
    const result = await Swal.fire({ 
        title: 'Êtes-vous sûr?', 
        text: "Cette action est irréversible!", 
        icon: 'warning', 
        showCancelButton: true, 
        confirmButtonColor: '#d33', 
        confirmButtonText: 'Oui, supprimer!' 
    });
    
    if (result.isConfirmed) {
        try {
            const response = await fetch(`/api/teacher/question/${questionId}`, { method: 'DELETE' });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message);
            Swal.fire('Supprimée!', 'La question a été supprimée.', 'success');
            loadQuestions(currentQuizId);
        } catch (error) {
            Swal.fire('Erreur', error.message, 'error');
        }
    }
}

function addOption(wrapperId, isEdit = false) {
    const wrapper = document.getElementById(wrapperId);
    const optionIndex = wrapper.children.length;
    const namePrefix = isEdit ? 'edit' : '';
    const newOption = document.createElement('div');
    newOption.className = 'input-group mb-2';
    newOption.innerHTML = `
        <div class="input-group-text">
            <input class="form-check-input mt-0" type="radio" name="${namePrefix}correctoption" value="${optionIndex}">
        </div>
        <input type="text" class="form-control" name="${namePrefix}optiontext" placeholder="Option ${optionIndex + 1}">
    `;
    wrapper.appendChild(newOption);
}

function toggleMcOptions(type, container) {
    const correctAnswerGroup = document.getElementById('correctAnswerGroup');
    const correctAnswerLabel = document.getElementById('correctAnswerLabel');
    const correctAnswerInput = document.getElementById('correctAnswer');
    const correctAnswerHelp = document.getElementById('correctAnswerHelp');

    if (type === 'multiple_choice') {
        container.style.display = 'block';
        correctAnswerGroup.style.display = 'none';
    } else if (type === 'true_false') {
        container.style.display = 'none';
        correctAnswerGroup.style.display = 'block';
        correctAnswerLabel.textContent = 'Réponse correcte';
        correctAnswerInput.placeholder = 'Entrez Vrai ou Faux';
        correctAnswerHelp.textContent = 'Entrez "Vrai" ou "Faux" comme réponse correcte';
    } else if (type === 'open_ended') {
        container.style.display = 'none';
        correctAnswerGroup.style.display = 'block';
        correctAnswerLabel.textContent = 'Réponse modèle';
        correctAnswerInput.placeholder = 'Entrez la réponse modèle attendue';
        correctAnswerHelp.textContent = 'Cette réponse servira de référence pour la correction';
    }
}

// FIX: Nouvelle fonction pour afficher le type de question
function getQuestionTypeText(type) {
    const types = {
        'true_false': 'Vrai/Faux',
        'multiple_choice': 'Choix Multiple',
        'open_ended': 'Ouverte'
    };
    return types[type] || type;
}

function getStatusText(status) {
    const statuses = { 
        draft: 'Brouillon', 
        upcoming: 'À venir', 
        active: 'En cours', 
        completed: 'Terminé',
        published: 'Publié'
    };
    return statuses[status] || 'N/A';
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('fr-FR', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
}

function filterQuizzes() {
    let filteredQuizzes = [...quizzes];
    const searchTerm = document.getElementById('searchQuiz').value.toLowerCase();
    const courseId = document.getElementById('filterCourse').value;
    const status = document.getElementById('filterStatus').value;
    
    if (searchTerm) {
        filteredQuizzes = filteredQuizzes.filter(q => 
            q.title.toLowerCase().includes(searchTerm)
        );
    }
    if (courseId) {
        filteredQuizzes = filteredQuizzes.filter(q => q.courseId === courseId);
    }
    if (status) {
        filteredQuizzes = filteredQuizzes.filter(q => q.status === status);
    }
    
    displayQuizzes(filteredQuizzes);
}

// Exposer les fonctions globalement
window.manageQuiz = manageQuiz;
window.editQuestion = editQuestion;
window.deleteQuestion = deleteQuestion;
window.deleteQuiz = deleteQuiz;
window.publishQuiz = publishQuiz;