const express = require('express');
const router = express.Router();
const { 
    getEvents, 
    getTodayEvents, 
    getUpcomingEvents, 
    createEvent, 
    updateEvent, 
    deleteEvent 
} = require('../controllers/eventController');

// Get all events for the authenticated user
router.get('/', getEvents);

// Get today's events
router.get('/today', getTodayEvents);

// Get upcoming events
router.get('/upcoming', getUpcomingEvents);

// Create a new event (teachers only)
router.post('/', createEvent);

// Update an event
router.put('/:id', updateEvent);

// Delete an event
router.delete('/:id', deleteEvent);

module.exports = router; 