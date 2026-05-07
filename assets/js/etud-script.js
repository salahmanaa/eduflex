// Gestionnaire d'événements global
document.addEventListener('DOMContentLoaded', () => {
    // Initialisation des tooltips Bootstrap
    const tooltips = [...document.querySelectorAll('[data-bs-toggle="tooltip"]')];
    tooltips.forEach(t => new bootstrap.Tooltip(t));

    // Gestionnaire de téléchargement de certificat
    document.querySelectorAll('.download-certificate').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const certId = btn.dataset.id;
            window.open(`/certificates/download/${certId}`, '_blank');
        });
    });

    // Gestionnaire de mise à jour du profil
    const profileForm = document.getElementById('profileForm');
    if(profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(profileForm);
            
            try {
                const response = await fetch('/api/profile', {
                    method: 'POST',
                    body: formData
                });
                
                if(response.ok) {
                    showToast('Profil mis à jour avec succès!', 'success');
                }
            } catch (error) {
                showToast('Erreur lors de la mise à jour', 'danger');
            }
        });
    }

    // Gestionnaire de timer de quiz
    const startQuizTimer = (duration, display) => {
        let timer = duration, minutes, seconds;
        const interval = setInterval(() => {
            minutes = parseInt(timer / 60, 10);
            seconds = parseInt(timer % 60, 10);

            display.textContent = 
                `${minutes}:${seconds.toString().padStart(2, '0')}`;

            if (--timer < 0) {
                clearInterval(interval);
                document.querySelector('#quizForm').submit();
            }
        }, 1000);
    };

    // Initialiser le timer si présent
    const quizTimerDisplay = document.querySelector('.quiz-timer');
    if(quizTimerDisplay) {
        startQuizTimer(1800, quizTimerDisplay); // 30 minutes
    }
});

// Fonction utilitaire pour afficher des notifications
function showToast(message, type = 'info') {
    const toastContainer = document.createElement('div');
    toastContainer.innerHTML = `
        <div class="toast align-items-center text-white bg-${type} border-0" role="alert">
            <div class="d-flex">
                <div class="toast-body">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        </div>
    `;
    
    document.body.appendChild(toastContainer);
    const toast = new bootstrap.Toast(toastContainer.querySelector('.toast'));
    toast.show();
    
    // Nettoyage après disparition
    toastContainer.querySelector('.toast').addEventListener('hidden.bs.toast', () => {
        toastContainer.remove();
    });
}

// Gestionnaire de chargement de fichier d'avatar
document.getElementById('avatarUpload')?.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if(!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        document.querySelectorAll('.avatar').forEach(img => {
            img.src = event.target.result;
        });
        localStorage.setItem('avatar', event.target.result);
    };
    reader.readAsDataURL(file);
});

// Récupération des préférences utilisateur
function loadUserPreferences() {
    const savedAvatar = localStorage.getItem('avatar');
    if(savedAvatar) {
        document.querySelectorAll('.avatar').forEach(img => {
            img.src = savedAvatar;
        });
    }
}

// Charger les préférences au démarrage
loadUserPreferences();