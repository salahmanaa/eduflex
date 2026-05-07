// Enhanced planning.js - Complete calendar functionality
document.addEventListener('DOMContentLoaded', function() {
    let calendar;
    let currentEventId = null;
    let isEditMode = false;

    // Initialize FullCalendar
    const calendarEl = document.getElementById('calendar');
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        headerToolbar: false,
        locale: 'fr',
        firstDay: 1,
        height: 'auto',
        editable: true,
        selectable: true,
        selectMirror: true,
        dayMaxEvents: true,
        weekends: true,
        
        // Load events from backend
        events: async function(fetchInfo, successCallback, failureCallback) {
            try {
                const response = await fetch('/api/events', {
                    method: 'GET',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const data = await response.json();
                
                if (data.success) {
                    const formattedEvents = data.events.map(event => ({
                        id: event._id,
                        title: event.title,
                        start: event.start,
                        end: event.end,
                        allDay: event.allDay || false,
                        backgroundColor: getCategoryColor(event.category),
                        borderColor: getCategoryColor(event.category),
                        description: event.description || '',
                        category: event.category || 'course',
                        extendedProps: {
                            description: event.description || '',
                            category: event.category || 'course'
                        }
                    }));
                    successCallback(formattedEvents);
                } else {
                    console.error('Failed to load events:', data.message);
                    failureCallback(data.message);
                }
            } catch (error) {
                console.error('Error loading events:', error);
                failureCallback('Erreur lors du chargement des événements');
                showNotification('Erreur lors du chargement des événements', 'error');
            }
        },

        // Handle date selection
        select: function(info) {
            openAddEventModal(info.start, info.end);
        },

        // Handle event click
        eventClick: function(info) {
            showEventDetails(info.event);
        },

        // Handle event drag & drop
        eventDrop: async function(info) {
            await updateEventDates(info.event, info.event.start, info.event.end);
        },

        // Handle event resize
        eventResize: async function(info) {
            await updateEventDates(info.event, info.event.start, info.event.end);
        }
    });

    calendar.render();
    updateCalendarTitle();

    // Calendar navigation
    document.getElementById('prev-btn').addEventListener('click', function() {
        calendar.prev();
        updateCalendarTitle();
    });

    document.getElementById('next-btn').addEventListener('click', function() {
        calendar.next();
        updateCalendarTitle();
    });

    document.getElementById('today-btn').addEventListener('click', function() {
        calendar.today();
        updateCalendarTitle();
    });

    // View buttons
    document.getElementById('month-view').addEventListener('click', function() {
        calendar.changeView('dayGridMonth');
        updateViewButtons(this);
    });

    document.getElementById('week-view').addEventListener('click', function() {
        calendar.changeView('timeGridWeek');
        updateViewButtons(this);
    });

    document.getElementById('day-view').addEventListener('click', function() {
        calendar.changeView('timeGridDay');
        updateViewButtons(this);
    });

    document.getElementById('list-view').addEventListener('click', function() {
        calendar.changeView('listWeek');
        updateViewButtons(this);
    });

    // Modal event handlers
    document.getElementById('saveEventBtn').addEventListener('click', saveEvent);
    document.getElementById('deleteEventBtn').addEventListener('click', deleteEvent);
    document.getElementById('editEventBtn').addEventListener('click', editEvent);

    // Form event handlers
    document.getElementById('eventReminder').addEventListener('change', function() {
        const reminderOptions = document.querySelector('.reminder-options');
        if (this.checked) {
            reminderOptions.classList.remove('d-none');
        } else {
            reminderOptions.classList.add('d-none');
        }
    });

    // Reset form when modal closes
    document.getElementById('addEventModal').addEventListener('hidden.bs.modal', function() {
        resetEventForm();
    });

    // Functions
    function updateCalendarTitle() {
        const title = calendar.view.title;
        document.getElementById('calendar-title').textContent = title;
    }

    function updateViewButtons(activeBtn) {
        document.querySelectorAll('.btn-group button').forEach(btn => {
            btn.classList.remove('active');
        });
        activeBtn.classList.add('active');
    }

    function getCategoryColor(category) {
        const colors = {
            'course': '#5461FF',
            'practical': '#36B37E', 
            'exam': '#FF5630',
            'live': '#FFAB00',
            'special': '#00B8D9'
        };
        return colors[category] || '#5461FF';
    }

    function getCategoryLabel(category) {
        const labels = {
            'course': 'Cours régulier',
            'practical': 'Travaux pratiques',
            'exam': 'Examen',
            'live': 'Session live',
            'special': 'Événement spécial'
        };
        return labels[category] || 'Non catégorisé';
    }

    function openAddEventModal(start, end = null) {
        isEditMode = false;
        currentEventId = null;
        
        // Set modal title
        document.getElementById('addEventModalLabel').textContent = 'Ajouter un événement';
        document.getElementById('saveEventBtn').textContent = 'Enregistrer';
        
        // Pre-fill dates
        const startDate = new Date(start);
        const endDate = end ? new Date(end) : new Date(startDate.getTime() + 60 * 60 * 1000); // +1 hour
        
        document.getElementById('eventStartDate').value = startDate.toISOString().slice(0, 10);
        document.getElementById('eventStartTime').value = startDate.toTimeString().slice(0, 5);
        document.getElementById('eventEndDate').value = endDate.toISOString().slice(0, 10);
        document.getElementById('eventEndTime').value = endDate.toTimeString().slice(0, 5);
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('addEventModal'));
        modal.show();
    }

    function showEventDetails(event) {
        // Populate event details
        document.getElementById('detailTitle').textContent = event.title;
        document.getElementById('detailDate').textContent = event.start.toLocaleDateString('fr-FR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        const timeText = event.allDay ? 'Toute la journée' : 
            `${event.start.toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'})} - ${event.end ? event.end.toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'}) : ''}`;
        document.getElementById('detailTime').textContent = timeText;
        
        document.getElementById('detailCategory').textContent = getCategoryLabel(event.extendedProps.category);
        document.getElementById('detailDescription').textContent = event.extendedProps.description || 'Pas de description';
        
        // Store event ID for actions
        currentEventId = event.id;
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('eventDetailsModal'));
        modal.show();
    }

    function editEvent() {
        if (!currentEventId) return;
        
        // Get event from calendar
        const event = calendar.getEventById(currentEventId);
        if (!event) return;
        
        // Switch to edit mode
        isEditMode = true;
        
        // Hide details modal
        bootstrap.Modal.getInstance(document.getElementById('eventDetailsModal')).hide();
        
        // Populate form with event data
        document.getElementById('eventTitle').value = event.title;
        document.getElementById('eventStartDate').value = event.start.toISOString().slice(0, 10);
        document.getElementById('eventStartTime').value = event.start.toTimeString().slice(0, 5);
        
        if (event.end) {
            document.getElementById('eventEndDate').value = event.end.toISOString().slice(0, 10);
            document.getElementById('eventEndTime').value = event.end.toTimeString().slice(0, 5);
        }
        
        document.getElementById('eventCategory').value = event.extendedProps.category || 'course';
        document.getElementById('eventDescription').value = event.extendedProps.description || '';
        
        // Update modal title
        document.getElementById('addEventModalLabel').textContent = 'Modifier l\'événement';
        document.getElementById('saveEventBtn').textContent = 'Mettre à jour';
        
        // Show edit modal
        const modal = new bootstrap.Modal(document.getElementById('addEventModal'));
        modal.show();
    }

    async function saveEvent() {
        // Validate form
        const title = document.getElementById('eventTitle').value.trim();
        const startDate = document.getElementById('eventStartDate').value;
        const startTime = document.getElementById('eventStartTime').value;
        const endDate = document.getElementById('eventEndDate').value;
        const endTime = document.getElementById('eventEndTime').value;
        const category = document.getElementById('eventCategory').value;
        const description = document.getElementById('eventDescription').value.trim();
        
        if (!title) {
            showNotification('Le titre est requis', 'error');
            return;
        }
        
        if (!startDate || !startTime) {
            showNotification('La date et l\'heure de début sont requises', 'error');
            return;
        }
        
        if (!endDate || !endTime) {
            showNotification('La date et l\'heure de fin sont requises', 'error');
            return;
        }
        
        if (!category) {
            showNotification('La catégorie est requise', 'error');
            return;
        }
        
        // Create event data
        const eventData = {
            title,
            start: `${startDate}T${startTime}:00`,
            end: `${endDate}T${endTime}:00`,
            category,
            description,
            allDay: false,
            color: getCategoryColor(category)
        };
        
        try {
            const url = isEditMode ? `/api/events/${currentEventId}` : '/api/events';
            const method = isEditMode ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(eventData)
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Erreur lors de la sauvegarde');
            }
            
            if (data.success) {
                showNotification(
                    isEditMode ? 'Événement modifié avec succès' : 'Événement créé avec succès',
                    'success'
                );
                
                // Refresh calendar
                calendar.refetchEvents();
                renderUpcomingEvents();
                
                // Hide modal
                bootstrap.Modal.getInstance(document.getElementById('addEventModal')).hide();
            } else {
                throw new Error(data.message || 'Erreur lors de la sauvegarde');
            }
        } catch (error) {
            console.error('Error saving event:', error);
            showNotification(error.message, 'error');
        }
    }

    async function deleteEvent() {
        if (!currentEventId) return;
        
        const result = await Swal.fire({
            title: 'Confirmer la suppression',
            text: "Êtes-vous sûr de vouloir supprimer cet événement ?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Oui, supprimer',
            cancelButtonText: 'Annuler'
        });

        if (result.isConfirmed) {
            try {
                const response = await fetch(`/api/events/${currentEventId}`, {
                    method: 'DELETE',
                    credentials: 'include'
                });
                
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.message || 'Erreur lors de la suppression');
                }
                
                if (data.success) {
                    showNotification('Événement supprimé avec succès', 'success');
                    
                    // Refresh calendar
                    calendar.refetchEvents();
                    renderUpcomingEvents();
                    
                    // Hide modal
                    bootstrap.Modal.getInstance(document.getElementById('eventDetailsModal')).hide();
                } else {
                    throw new Error(data.message || 'Erreur lors de la suppression');
                }
            } catch (error) {
                console.error('Error deleting event:', error);
                showNotification(error.message, 'error');
            }
        }
    }

    async function updateEventDates(event, newStart, newEnd) {
        try {
            const response = await fetch(`/api/events/${event.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    title: event.title,
                    start: newStart.toISOString(),
                    end: newEnd ? newEnd.toISOString() : newStart.toISOString(),
                    category: event.extendedProps.category,
                    description: event.extendedProps.description,
                    allDay: event.allDay,
                    color: event.backgroundColor
                })
            });
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.message || 'Erreur lors de la mise à jour');
            }
            
            showNotification('Événement mis à jour', 'success');
            renderUpcomingEvents();
        } catch (error) {
            console.error('Error updating event:', error);
            showNotification(error.message, 'error');
            // Revert the change
            calendar.refetchEvents();
        }
    }

    function resetEventForm() {
        document.getElementById('addEventForm').reset();
        document.querySelector('.reminder-options').classList.add('d-none');
        isEditMode = false;
        currentEventId = null;
    }

    function showNotification(message, type = 'info') {
        const iconMap = {
            'success': 'success',
            'error': 'error',
            'warning': 'warning',
            'info': 'info'
        };
        
        Swal.fire({
            icon: iconMap[type],
            title: message,
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true
        });
    }

    // Auto-refresh events every 5 minutes
    setInterval(() => {
        calendar.refetchEvents();
    }, 5 * 60 * 1000);

    // After calendar.render();
    renderUpcomingEvents();

    // Add this function to render upcoming events
    async function renderUpcomingEvents() {
        const container = document.getElementById('upcoming-events-container');
        if (!container) return;
        try {
            const response = await fetch('/api/events', {
                method: 'GET',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();
            if (!data.success || !Array.isArray(data.events)) {
                container.innerHTML = '<div class="text-danger">Erreur lors du chargement des événements</div>';
                return;
            }
            // Filter for events from today onward
            const now = new Date();
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const upcoming = data.events.filter(ev => new Date(ev.start) >= startOfToday);
            if (upcoming.length === 0) {
                container.innerHTML = '<div class="text-muted">Aucun événement à venir</div>';
                return;
            }
            // Sort by start date
            upcoming.sort((a, b) => new Date(a.start) - new Date(b.start));
            container.innerHTML = upcoming.map(ev => {
                const start = new Date(ev.start);
                const end = new Date(ev.end);
                const dateStr = start.toLocaleDateString('fr-FR', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
                const timeStr = `${start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
                const cat = normalizeCategory(ev.category);
                return `
                    <div class="mb-3 border-bottom pb-2">
                        <div class="d-flex align-items-center mb-1">
                            <span class="badge event-badge me-2" style="background:${getCategoryColor(cat)} !important;color:#fff !important;border:none !important;min-width:90px;font-weight:500;">${getCategoryLabel(cat)}</span>
                            <span class="fw-bold me-2">${ev.title}</span>
                        </div>
                        <div class="text-muted small mb-1">${dateStr} | ${timeStr}</div>
                        <div class="small">${ev.description || ''}</div>
                    </div>
                `;
            }).join('');
        } catch (e) {
            container.innerHTML = '<div class="text-danger">Erreur lors du chargement des événements</div>';
        }
    }

    // Call renderUpcomingEvents after calendar refetch
    calendar.on('eventsSet', renderUpcomingEvents);

    // At the end of the file, add a <style> block to enforce badge color and visibility
    if (!document.getElementById('event-badge-style')) {
        const style = document.createElement('style');
        style.id = 'event-badge-style';
        style.innerHTML = `.event-badge { color: #fff !important; border: none !important; min-width: 90px; font-weight: 500; background: inherit !important; display: inline-block; text-align: center; }`;
        document.head.appendChild(style);
    }

    function normalizeCategory(category) {
        if (!category) return 'course';
        const map = {
            'cours régulier': 'course',
            'cours': 'course',
            'travaux pratiques': 'practical',
            'tp': 'practical',
            'examen': 'exam',
            'session live': 'live',
            'live': 'live',
            'événement spécial': 'special',
            'special': 'special',
        };
        const key = category.toString().trim().toLowerCase();
        return map[key] || key;
    }
});