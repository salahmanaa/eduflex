const Event = require('../models/Event');
const Course = require('../models/Course');
const User = require('../models/User');

// Get all events for a user (student or teacher)
const getEvents = async (req, res) => {
    try {
        const userId = req.user._id;
        const userRole = req.user.role;
        
        let events;
        
        if (userRole === 'student') {
            // For students, get events from their enrolled courses
            const enrolledCourses = await Course.find({ 
                'students.studentId': userId 
            });
            
            events = await Event.find({
                $or: [
                    { students: userId },
                    { course: { $in: enrolledCourses.map(c => c._id) } }
                ]
            }).populate('course instructor students');
        } else if (userRole === 'teacher') {
            // For teachers, get events they created or are assigned to
            events = await Event.find({
                $or: [
                    { instructor: userId },
                    { course: { $in: await Course.find({ instructor: userId }).select('_id') } }
                ]
            }).populate('course instructor students');
        } else {
            return res.status(403).json({
                success: false,
                message: 'Accès refusé'
            });
        }

        res.json({
            success: true,
            events: events.map(event => ({
                _id: event._id,
                title: event.title,
                description: event.description,
                start: event.start,
                end: event.end,
                allDay: event.allDay,
                category: event.category,
                course: event.course,
                instructor: event.instructor,
                students: event.students,
                location: event.location,
                color: event.color,
                isRecurring: event.isRecurring
            }))
        });

    } catch (error) {
        console.error('Error getting events:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du chargement des événements'
        });
    }
};

// Get today's events
const getTodayEvents = async (req, res) => {
    try {
        const userId = req.user._id;
        const userRole = req.user.role;
        
        let events;
        
        if (userRole === 'student') {
            const enrolledCourses = await Course.find({ 
                'students.studentId': userId 
            });
            
            events = await Event.findTodayEvents(userId).populate('course instructor students');
        } else if (userRole === 'teacher') {
            events = await Event.findTodayEvents(userId).populate('course instructor students');
        } else {
            return res.status(403).json({
                success: false,
                message: 'Accès refusé'
            });
        }

        res.json({
            success: true,
            events: events.map(event => ({
                _id: event._id,
                title: event.title,
                description: event.description,
                start: event.start,
                end: event.end,
                category: event.category,
                course: event.course,
                instructor: event.instructor,
                location: event.location,
                color: event.color
            }))
        });

    } catch (error) {
        console.error('Error getting today events:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du chargement des événements du jour'
        });
    }
};

// Get upcoming events
const getUpcomingEvents = async (req, res) => {
    try {
        const userId = req.user._id;
        const userRole = req.user.role;
        const limit = parseInt(req.query.limit) || 5;
        
        let events;
        
        if (userRole === 'student') {
            events = await Event.findUpcomingEvents(userId, limit).populate('course instructor students');
        } else if (userRole === 'teacher') {
            events = await Event.findUpcomingEvents(userId, limit).populate('course instructor students');
        } else {
            return res.status(403).json({
                success: false,
                message: 'Accès refusé'
            });
        }

        res.json({
            success: true,
            events: events.map(event => ({
                _id: event._id,
                title: event.title,
                description: event.description,
                start: event.start,
                end: event.end,
                category: event.category,
                course: event.course,
                instructor: event.instructor,
                location: event.location,
                color: event.color
            }))
        });

    } catch (error) {
        console.error('Error getting upcoming events:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du chargement des événements à venir'
        });
    }
};

// Create a new event
const createEvent = async (req, res) => {
    try {
        const userId = req.user._id;
        const userRole = req.user.role;
        
        if (userRole !== 'teacher') {
            return res.status(403).json({
                success: false,
                message: 'Seuls les enseignants peuvent créer des événements'
            });
        }

        const {
            title,
            description,
            start,
            end,
            allDay,
            category,
            course,
            students,
            location,
            reminder,
            color,
            isRecurring,
            recurringPattern
        } = req.body;

        // Validate required fields
        if (!title || !start || !end) {
            return res.status(400).json({
                success: false,
                message: 'Titre, début et fin sont obligatoires'
            });
        }

        // Check if course exists and teacher has access
        if (course) {
            const courseExists = await Course.findOne({ 
                _id: course, 
                instructor: userId 
            });
            if (!courseExists) {
                return res.status(403).json({
                    success: false,
                    message: 'Accès refusé à ce cours'
                });
            }
        }

        const event = new Event({
            title,
            description,
            start: new Date(start),
            end: new Date(end),
            allDay: allDay || false,
            category: category || 'course',
            course,
            instructor: userId,
            students: students || [],
            location,
            reminder: reminder || { enabled: false, time: 15 },
            color: color || '#5461FF',
            isRecurring: isRecurring || false,
            recurringPattern: recurringPattern || null
        });

        await event.save();

        res.json({
            success: true,
            message: 'Événement créé avec succès',
            event
        });

    } catch (error) {
        console.error('Error creating event:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la création de l\'événement'
        });
    }
};

// Update an event
const updateEvent = async (req, res) => {
    try {
        const userId = req.user._id;
        const userRole = req.user.role;
        const eventId = req.params.id;

        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Événement non trouvé'
            });
        }

        // Check if user has permission to update this event
        if (userRole === 'teacher' && event.instructor.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Accès refusé à cet événement'
            });
        }

        const updatedEvent = await Event.findByIdAndUpdate(
            eventId,
            req.body,
            { new: true, runValidators: true }
        ).populate('course instructor students');

        res.json({
            success: true,
            message: 'Événement mis à jour avec succès',
            event: updatedEvent
        });

    } catch (error) {
        console.error('Error updating event:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la mise à jour de l\'événement'
        });
    }
};

// Delete an event
const deleteEvent = async (req, res) => {
    try {
        const userId = req.user._id;
        const userRole = req.user.role;
        const eventId = req.params.id;

        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Événement non trouvé'
            });
        }

        // Check if user has permission to delete this event
        if (userRole === 'teacher' && event.instructor.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Accès refusé à cet événement'
            });
        }

        await Event.findByIdAndDelete(eventId);

        res.json({
            success: true,
            message: 'Événement supprimé avec succès'
        });

    } catch (error) {
        console.error('Error deleting event:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la suppression de l\'événement'
        });
    }
};

module.exports = {
    getEvents,
    getTodayEvents,
    getUpcomingEvents,
    createEvent,
    updateEvent,
    deleteEvent
}; 