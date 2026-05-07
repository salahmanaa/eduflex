// Shared forum logic for all roles

document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const discussionsContainer = document.getElementById('discussionsContainer');
    const categoryContainer = document.getElementById('categoryContainer');
    const createDiscussionBtn = document.getElementById('createDiscussionBtn');
    const discussionForm = document.getElementById('discussionForm');
    const discussionTitle = document.getElementById('discussionTitle');
    const discussionCategory = document.getElementById('discussionCategory');
    const discussionContent = document.getElementById('discussionContent');
    const commentsModal = document.getElementById('commentsModal');
    const commentsContainer = document.getElementById('commentsContainer');
    const commentForm = document.getElementById('commentForm');
    const commentContent = document.getElementById('commentContent');

    let currentDiscussionId = null;
    let selectedCategory = null;

    // Fetch and display categories
    async function loadCategories() {
        try {
            const res = await fetch('/api/forum/categories', { credentials: 'include' });
            let categories = await res.json();
            // Default enum categories
            const defaultCategories = [
                { _id: 'web', count: 0 },
                { _id: 'ia', count: 0 },
                { _id: 'data', count: 0 },
                { _id: 'design', count: 0 },
                { _id: 'general', count: 0 }
            ];
            // Sidebar: show only used categories
            if (categoryContainer) {
                const usedCategories = (Array.isArray(categories) && categories.length) ? categories : defaultCategories;
                categoryContainer.innerHTML = `<a href="#" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center${selectedCategory===null?' active':''}"><span>Tous</span></a>` +
                    usedCategories.map(cat => `
                    <a href=\"#\" class=\"list-group-item list-group-item-action d-flex justify-content-between align-items-center${selectedCategory===cat._id?' active':''}\">
                        <span>${cat._id || 'Sans catégorie'}</span>
                        <span class=\"badge bg-primary rounded-pill\">${cat.count}</span>
                    </a>
                `).join('');
            }
            // Modal select: always show all default categories
            if (discussionCategory) {
                discussionCategory.innerHTML = '<option value="">Choisir une catégorie</option>' +
                    defaultCategories.map(cat => `<option value="${cat._id}">${cat._id}</option>`).join('');
            }
        } catch (e) {
            // On error, fallback to default categories
            const defaultCategories = [
                { _id: 'web', count: 0 },
                { _id: 'ia', count: 0 },
                { _id: 'data', count: 0 },
                { _id: 'design', count: 0 },
                { _id: 'general', count: 0 }
            ];
            if (categoryContainer) categoryContainer.innerHTML = `<a href="#" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center${selectedCategory===null?' active':''}"><span>Tous</span></a>` +
                defaultCategories.map(cat => `
                <a href=\"#\" class=\"list-group-item list-group-item-action d-flex justify-content-between align-items-center${selectedCategory===cat._id?' active':''}\">
                    <span>${cat._id}</span>
                    <span class=\"badge bg-primary rounded-pill\">0</span>
                </a>
            `).join('');
            if (discussionCategory) {
                discussionCategory.innerHTML = '<option value="">Choisir une catégorie</option>' +
                    defaultCategories.map(cat => `<option value="${cat._id}">${cat._id}</option>`).join('');
            }
        }
    }

    // Fetch and display discussions (with optional category filter)
    async function loadDiscussions() {
        try {
            let url = '/api/forum/discussions';
            if (selectedCategory) {
                url += `?category=${encodeURIComponent(selectedCategory)}`;
            }
            const res = await fetch(url, { credentials: 'include' });
            const discussions = await res.json();
            if (discussionsContainer) {
                discussionsContainer.innerHTML = discussions.length ? discussions.map(d => `
                    <div class="list-group-item p-3" data-id="${d._id}">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <div class="flex-grow-1 me-3">
                                <h5 class="mb-1">${d.title}</h5>
                                <div class="d-flex align-items-center small text-muted mb-2">
                                    <span class="me-2"><i class="fas fa-user"></i> ${(d.author && (d.author.fullName || d.author.firstName + ' ' + d.author.lastName)) || 'Utilisateur'}</span>
                                    <span class="me-2">•</span>
                                    <span><i class="fas fa-clock"></i> ${d.createdAt}</span>
                                </div>
                                <p class="mb-2">${d.content}</p>
                                <div class="d-flex align-items-center">
                                    <span class="badge bg-primary me-2">${d.category || 'Général'}</span>
                                    <span class="me-3"><i class="far fa-comment"></i> ${d.commentsCount || 0}</span>
                                    <button class="btn btn-sm btn-outline-secondary ms-2 view-comments-btn" data-id="${d._id}">Voir les commentaires</button>
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('') : '<div class="p-3 text-muted">Aucune discussion dans cette catégorie.</div>';
            }
        } catch (e) {
            if (discussionsContainer) discussionsContainer.innerHTML = '<div class="p-3 text-danger">Erreur chargement discussions</div>';
        }
    }

    // Show comments modal and load comments
    async function showCommentsModal(discussionId) {
        currentDiscussionId = discussionId;
        if (commentsModal) {
            const modal = new bootstrap.Modal(commentsModal);
            modal.show();
        }
        await loadComments(discussionId);
    }

    // Fetch and display comments for a discussion
    async function loadComments(discussionId) {
        try {
            const res = await fetch(`/api/forum/discussions/${discussionId}/comments`, { credentials: 'include' });
            const comments = await res.json();
            if (commentsContainer) {
                commentsContainer.innerHTML = comments.length ? comments.map(c => `
                    <div class="mb-3 border-bottom pb-2">
                        <div class="d-flex align-items-center mb-1">
                            <span class="fw-bold me-2">${(c.author && (c.author.fullName || c.author.firstName + ' ' + c.author.lastName)) || 'Utilisateur'}</span>
                            <span class="text-muted small">${new Date(c.createdAt).toLocaleString()}</span>
                        </div>
                        <div>${c.content}</div>
                    </div>
                `).join('') : '<div class="text-muted">Aucun commentaire</div>';
            }
        } catch (e) {
            if (commentsContainer) commentsContainer.innerHTML = '<div class="p-3 text-danger">Erreur chargement commentaires</div>';
        }
    }

    // Create a new discussion
    if (discussionForm) {
        discussionForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            try {
                const res = await fetch('/api/forum/discussions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        title: discussionTitle.value,
                        category: discussionCategory.value,
                        content: discussionContent.value
                    })
                });
                if (!res.ok) throw new Error('Erreur création discussion');
                discussionForm.reset();
                bootstrap.Modal.getInstance(document.getElementById('createDiscussionModal')).hide();
                await loadDiscussions();
                await loadCategories();
            } catch (e) {
                alert('Erreur lors de la création de la discussion.');
            }
        });
    }

    // Create a new comment
    if (commentForm) {
        commentForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            if (!currentDiscussionId) return;
            try {
                const res = await fetch(`/api/forum/discussions/${currentDiscussionId}/comments`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ content: commentContent.value })
                });
                if (!res.ok) throw new Error('Erreur création commentaire');
                commentForm.reset();
                await loadComments(currentDiscussionId);
                await loadDiscussions();
            } catch (e) {
                alert('Erreur lors de l\'ajout du commentaire.');
            }
        });
    }

    // Open create discussion modal
    if (createDiscussionBtn) {
        createDiscussionBtn.addEventListener('click', function() {
            new bootstrap.Modal(document.getElementById('createDiscussionModal')).show();
        });
    }

    // Delegate click for view-comments-btn
    if (discussionsContainer) {
        discussionsContainer.addEventListener('click', function(e) {
            const btn = e.target.closest('.view-comments-btn');
            if (btn) {
                const discussionId = btn.getAttribute('data-id');
                showCommentsModal(discussionId);
            }
        });
    }

    // Category click handler
    if (categoryContainer) {
        categoryContainer.addEventListener('click', function(e) {
            const link = e.target.closest('.list-group-item');
            if (link) {
                const cat = link.querySelector('span').textContent.trim();
                selectedCategory = cat === 'Tous' ? null : cat;
                // Highlight selected
                categoryContainer.querySelectorAll('.list-group-item').forEach(item => item.classList.remove('active'));
                link.classList.add('active');
                loadDiscussions();
            }
        });
    }

    // Initial load
    loadCategories();
    loadDiscussions();
}); 