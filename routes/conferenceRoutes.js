const express = require('express');
const router = express.Router();
const Conference = require('../models/Conference');
const { v4: uuidv4 } = require('uuid');

// Generate a random 6-digit code
function generateConferenceCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Create a new conference
router.post('/', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Not authenticated' });
        }

        const code = generateConferenceCode();
        const roomId = uuidv4();

        const conference = new Conference({
            title: req.body.title,
            description: req.body.description,
            startTime: new Date(),
            duration: req.body.duration,
            host: req.user._id,
            code: code,
            roomId: roomId,
            status: 'scheduled'
        });

        await conference.save();
        res.json(conference);
    } catch (error) {
        console.error('Error creating conference:', error);
        res.status(500).json({ message: 'Error creating conference' });
    }
});

// Start a conference
router.post('/:id/start', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Not authenticated' });
        }

        const conference = await Conference.findById(req.params.id);
        
        if (!conference) {
            return res.status(404).json({ message: 'Conference not found' });
        }

        if (conference.host.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        conference.status = 'active';
        conference.startTime = new Date();
        await conference.save();

        res.json(conference);
    } catch (error) {
        console.error('Error starting conference:', error);
        res.status(500).json({ message: 'Error starting conference' });
    }
});

// End a conference
router.post('/:id/end', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Not authenticated' });
        }

        const conference = await Conference.findById(req.params.id);
        
        if (!conference) {
            return res.status(404).json({ message: 'Conference not found' });
        }

        if (conference.host.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        conference.status = 'completed';
        conference.endTime = new Date();
        await conference.save();

        res.json(conference);
    } catch (error) {
        console.error('Error ending conference:', error);
        res.status(500).json({ message: 'Error ending conference' });
    }
});

// Join a conference by code
router.post('/join/:code', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Not authenticated' });
        }

        const conference = await Conference.findOne({ 
            code: req.params.code,
            status: 'active'
        });

        if (!conference) {
            return res.status(404).json({ message: 'Conference not found or not active' });
        }

        // Add participant if not already in the conference
        if (!conference.participants.some(p => p.user.toString() === req.user._id.toString())) {
            conference.participants.push({
                user: req.user._id,
                joinTime: new Date()
            });
            await conference.save();
        }

        res.json({ 
            roomId: conference.roomId,
            title: conference.title,
            host: conference.host
        });
    } catch (error) {
        console.error('Error joining conference:', error);
        res.status(500).json({ message: 'Error joining conference' });
    }
});

// Get conference details
router.get('/:id', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Not authenticated' });
        }

        const conference = await Conference.findById(req.params.id)
            .populate('host', 'name')
            .populate('participants.user', 'name');

        if (!conference) {
            return res.status(404).json({ message: 'Conference not found' });
        }

        res.json(conference);
    } catch (error) {
        console.error('Error fetching conference:', error);
        res.status(500).json({ message: 'Error fetching conference' });
    }
});

// Get teacher's conferences
router.get('/teacher', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Not authenticated' });
        }

        const conferences = await Conference.find({ host: req.user._id })
            .populate('host', 'name')
            .populate('participants.user', 'name')
            .sort('-startTime');

        res.json(conferences);
    } catch (error) {
        console.error('Error fetching conferences:', error);
        res.status(500).json({ message: 'Error fetching conferences' });
    }
});

module.exports = router; 