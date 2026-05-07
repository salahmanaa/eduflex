const express = require('express');
const router = express.Router();
const Discussion = require('../models/discussion');
const Comment = require('../models/comment');
const User = require('../models/User');

// Get recent questions for teacher dashboard
router.get('/recent-questions', async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'teacher') {
      return res.status(403).json({ 
        success: false, 
        message: 'Accès refusé: Réservé aux enseignants' 
      });
    }

    const recentQuestions = await Discussion.getRecentQuestionsForTeacher(req.user._id, 5);
    
    const formattedQuestions = recentQuestions.map(question => ({
      id: question._id,
      title: question.title,
      content: question.content.substring(0, 100) + (question.content.length > 100 ? '...' : ''),
      category: question.category,
      courseTitle: question.course?.title || 'Général',
      authorName: question.author ? `${question.author.firstName} ${question.author.lastName}` : 'Anonyme',
      timeAgo: question.timeAgo,
      commentsCount: question.commentsCount,
      isAnswered: question.isAnswered
    }));

    res.json({
      success: true,
      questions: formattedQuestions
    });
  } catch (error) {
    console.error('Error getting recent questions:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors du chargement des questions récentes' 
    });
  }
});

// Créer une nouvelle discussion
router.post('/discussions', async (req, res) => {
  try {
    const { title, content, category } = req.body;
    
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'Non authentifié' });
    }

    const newDiscussion = new Discussion({
      title,
      content,
      category,
      author: req.user._id
    });

    await newDiscussion.save();
    res.status(201).json(newDiscussion);
  } catch (err) {
    console.error('Discussion creation error:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Get popular topics
router.get('/popular-topics', async (req, res) => {
    try {
        const topics = await Discussion.find()
            .sort({ commentsCount: -1, views: -1 })
            .limit(4)
            .lean();

        res.json(topics);
    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Récupérer toutes les discussions
router.get('/discussions', async (req, res) => {
    try {
        const filter = {};
        if (req.query.category) {
            filter.category = req.query.category;
        }
        const discussions = await Discussion.find(filter)
            .sort({ createdAt: -1 })
            .populate('author', 'fullName firstName lastName')
            .lean();

        // Formater la date
        const formatted = discussions.map(d => ({
            ...d,
            createdAt: d.createdAt.toISOString().split('T')[0]
        }));

        res.json(formatted);
    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Ajouter un commentaire
router.post('/discussions/:id/comments', async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'Non authentifié' });
    }

    const newComment = new Comment({
      content,
      discussion: req.params.id,
      author: req.user._id
    });

    await newComment.save();
    
    // Mettre à jour le compteur de commentaires
    await Discussion.findByIdAndUpdate(req.params.id, {
      $inc: { commentsCount: 1 }
    });

    res.status(201).json(newComment);
  } catch (err) {
    console.error('Comment creation error:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Récupérer les commentaires d'une discussion
router.get('/discussions/:id/comments', async (req, res) => {
  try {
    const comments = await Comment.find({ discussion: req.params.id })
      .populate('author', 'fullName firstName lastName')
      .sort({ createdAt: -1 });

    res.json(comments);
  } catch (err) {
    console.error('Get comments error:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Get categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await Discussion.aggregate([
      { 
        $group: {
          _id: "$category",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json(categories);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;