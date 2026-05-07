document.addEventListener("scroll", function () {
    const hero = document.querySelector(".hero-section");
    const scrollTop = window.scrollY;
    hero.style.backgroundPositionY = scrollTop * 0.2 + "px";
});

// Gestion des modales de connexion/inscription
document.addEventListener('DOMContentLoaded', function() {
    // Gestion des modales de cours
    document.querySelectorAll('.course-card').forEach(card => {
        card.addEventListener('click', function(e) {
            // Si le clic n'est pas sur un bouton d'inscription
            if (!e.target.classList.contains('btn')) {
                e.preventDefault();
                var courseModal = new bootstrap.Modal(document.getElementById('courseDetailsModal'));
                courseModal.show();
            }
        });
    });

    // Gestion du contenu verrouillé
    document.querySelectorAll('.locked-content').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            var loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
            loginModal.show();
        });
    });

    // Gestion du formulaire de connexion
    const loginForm = document.querySelector('#loginModal form');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            // Simulation de connexion - À remplacer par votre logique d'authentification
            console.log('Tentative de connexion...');
        });
    }

    // Gestion du formulaire d'inscription
    const signupForm = document.querySelector('#signupModal form');
    if (signupForm) {
        signupForm.addEventListener('submit', function(e) {
            e.preventDefault();
            // Simulation d'inscription - À remplacer par votre logique d'inscription
            console.log('Tentative d\'inscription...');
        });
    }

    // Animation smooth scroll pour les ancres
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const target = document.querySelector(targetId);
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });

    // Effet parallax pour le hero
    window.addEventListener('scroll', function() {
        const hero = document.querySelector('.hero-section');
        if (hero) {
            const scrolled = window.pageYOffset;
            hero.style.backgroundPositionY = (scrolled * 0.5) + 'px';
        }
    });

    // Gestion des tooltips Bootstrap
    var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
});