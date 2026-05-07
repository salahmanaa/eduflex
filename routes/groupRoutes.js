const express = require('express');
const router = express.Router();
const Group = require('../models/Group');
const Message = require('../models/Message');
const authenticateUser = require('../middleware/auth');
const User = require('../models/User');

// Generate random group code
function generateGroupCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Create a new group (Teacher only)
router.post('/', authenticateUser, async (req, res) => {
  try {
    // Check if user is teacher
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ error: 'Only teachers can create groups' });
    }

    const { name } = req.body;
    const code = generateGroupCode();

    const group = new Group({
      name,
      code,
      teacher: req.user._id,
      students: []
    });

    await group.save();
    res.status(201).json(group);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete a group (Teacher only)
router.delete('/:id', authenticateUser, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Check if user is the teacher of the group
    if (group.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Delete all messages in the group
    await Message.deleteMany({ group: group._id });
    await Group.deleteOne({ _id: group._id });
    res.json({ message: 'Group deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Join a group (Student)
router.post('/join', authenticateUser, async (req, res) => {
  try {
    // Check if user is student
    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Only students can join groups' });
    }

    const { code } = req.body;
    const group = await Group.findOne({ code });
    if (!group) {
      return res.status(404).json({ error: 'Invalid group code' });
    }

    // Check if student is already in group
    if (group.students.includes(req.user._id)) {
      return res.status(400).json({ error: 'Already in group' });
    }

    group.students.push(req.user._id);
    await group.save();
    res.json(group);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get groups for teacher
router.get('/teacher', authenticateUser, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const groups = await Group.find({ teacher: req.user._id });
    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get groups for student
router.get('/student', authenticateUser, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const groups = await Group.find({ students: req.user._id });
    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get messages for a group
router.get('/:id/messages', authenticateUser, async (req, res) => {
  try {
    const groupId = req.params.id;
    const group = await Group.findById(groupId);

    // Check if user is part of the group
    if (!group.students.includes(req.user._id) && group.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const messages = await Message.find({ group: groupId })
      .sort({ createdAt: 1 })
      .populate('sender', 'name role');
    
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Send message to group
router.post('/:id/messages', authenticateUser, async (req, res) => {
  try {
    const groupId = req.params.id;
    const { content } = req.body;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Check if user is part of the group
    if (!group.students.includes(req.user._id) && group.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const message = new Message({
      group: groupId,
      sender: req.user._id,
      content
    });

    await message.save();
    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;