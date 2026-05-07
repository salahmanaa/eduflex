class ConferenceHandler {
    constructor(isTeacher) {
        this.isTeacher = isTeacher;
        this.userId = localStorage.getItem('userId');
        this.username = localStorage.getItem('username');
        this.setupEventListeners();
        this.loadConferences();
    }

    async loadConferences() {
        try {
            const endpoint = this.isTeacher ? '/api/conferences/teacher' : '/api/conferences/student';
            const response = await fetch(endpoint, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load conferences');
            }

            const conferences = await response.json();
            this.displayConferences(conferences);
        } catch (error) {
            console.error('Error loading conferences:', error);
            alert('Failed to load conferences. Please try again.');
        }
    }

    displayConferences(conferences) {
        const upcomingContainer = document.getElementById('upcoming-conferences');
        const pastContainer = document.getElementById('past-conferences');
        
        if (!upcomingContainer || !pastContainer) return;

        upcomingContainer.innerHTML = '';
        pastContainer.innerHTML = '';

        const now = new Date();

        conferences.forEach(conference => {
            const startTime = new Date(conference.startTime);
            const isUpcoming = startTime > now || conference.status === 'active';
            const container = isUpcoming ? upcomingContainer : pastContainer;

            const card = this.createConferenceCard(conference);
            container.appendChild(card);
        });
    }

    createConferenceCard(conference) {
        const startTime = new Date(conference.startTime);
        const card = document.createElement('div');
        card.className = 'conference-item border rounded p-3 mb-3';
        
        const statusBadgeClass = this.getStatusBadgeClass(conference.status);
        const actionButton = this.createActionButton(conference);

        card.innerHTML = `
            <div class="row align-items-center">
                <div class="col-md-2 text-center">
                    <div class="date-badge p-2">
                        <h3 class="mb-0">${startTime.getDate()}</h3>
                        <p class="small mb-0">${startTime.toLocaleString('default', { month: 'short' })}</p>
                    </div>
                </div>
                <div class="col-md-7">
                    <div class="d-flex align-items-center mb-2">
                        <h6 class="mb-0 me-2">${conference.title}</h6>
                        <span class="badge ${statusBadgeClass}">${conference.status}</span>
                    </div>
                    <p class="text-muted small mb-1">
                        <i class="fas fa-clock me-1"></i> 
                        ${startTime.toLocaleTimeString()} - ${conference.duration} min
                    </p>
                    <p class="text-muted small mb-0">
                        <i class="fas fa-users me-1"></i> 
                        ${conference.participants.length} participants
                    </p>
                </div>
                <div class="col-md-3 text-md-end">
                    ${actionButton}
                </div>
            </div>
        `;

        return card;
    }

    getStatusBadgeClass(status) {
        switch (status) {
            case 'scheduled': return 'bg-info';
            case 'active': return 'bg-success';
            case 'completed': return 'bg-secondary';
            case 'cancelled': return 'bg-danger';
            default: return 'bg-secondary';
        }
    }

    createActionButton(conference) {
        if (conference.status === 'completed') {
            return '<button class="btn btn-sm btn-outline-secondary" disabled>Completed</button>';
        }

        if (conference.status === 'cancelled') {
            return '<button class="btn btn-sm btn-outline-danger" disabled>Cancelled</button>';
        }

        if (conference.status === 'active') {
            const buttonText = this.isTeacher ? 'Continue' : 'Join';
            return `<button class="btn btn-success join-conference" data-id="${conference._id}">
                        <i class="fas fa-video me-1"></i> ${buttonText}
                    </button>`;
        }

        if (this.isTeacher) {
            return `<button class="btn btn-primary start-conference" data-id="${conference._id}">
                        <i class="fas fa-play me-1"></i> Start
                    </button>`;
        }

        return `<button class="btn btn-outline-primary" disabled>Waiting for teacher</button>`;
    }

    async createConference(formData) {
        try {
            const response = await fetch('/api/conferences', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                throw new Error('Failed to create conference');
            }

            await this.loadConferences();
            return true;
        } catch (error) {
            console.error('Error creating conference:', error);
            return false;
        }
    }

    async startConference(conferenceId) {
        try {
            const response = await fetch(`/api/conferences/${conferenceId}/start`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to start conference');
            }

            const conference = await response.json();
            this.joinConference(conferenceId);
        } catch (error) {
            console.error('Error starting conference:', error);
            alert('Failed to start conference. Please try again.');
        }
    }

    async joinConference(conferenceId) {
        try {
            const response = await fetch(`/api/conferences/${conferenceId}/join`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to join conference');
            }

            const { roomId } = await response.json();
            window.location.href = `/conference-room.html?roomId=${roomId}&userId=${this.userId}&username=${this.username}&isTeacher=${this.isTeacher}`;
        } catch (error) {
            console.error('Error joining conference:', error);
            alert('Failed to join conference. Please try again.');
        }
    }

    setupEventListeners() {
        document.addEventListener('click', async (e) => {
            if (e.target.closest('.start-conference')) {
                const conferenceId = e.target.closest('.start-conference').dataset.id;
                await this.startConference(conferenceId);
            }

            if (e.target.closest('.join-conference')) {
                const conferenceId = e.target.closest('.join-conference').dataset.id;
                await this.joinConference(conferenceId);
            }
        });

        const newConferenceForm = document.getElementById('newConferenceForm');
        if (newConferenceForm) {
            newConferenceForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = {
                    title: e.target.title.value,
                    description: e.target.description.value,
                    groupId: e.target.groupId.value,
                    startTime: e.target.startTime.value,
                    duration: parseInt(e.target.duration.value)
                };

                const success = await this.createConference(formData);
                if (success) {
                    const modal = bootstrap.Modal.getInstance(document.getElementById('newConferenceModal'));
                    modal.hide();
                    e.target.reset();
                } else {
                    alert('Failed to create conference. Please try again.');
                }
            });
        }
    }
} 