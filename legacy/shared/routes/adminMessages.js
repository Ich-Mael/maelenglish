const express      = require('express');
const router       = express.Router();
const VisitorMessage = require('../models/visitorMessage');
const catchAsync   = require('../utilities/catchAsync');
const { isLoggedIn, checkRoles } = require('../middlewares/auth');

const adminOnly = [isLoggedIn, checkRoles(['admin', 'super-admin'])];

// List all messages, unread first
router.get('/', ...adminOnly, catchAsync(async (req, res) => {
    const messages = await VisitorMessage.find().sort({ isRead: 1, createdAt: -1 }).lean();
    const unreadCount = messages.filter(m => !m.isRead).length;
    res.render('admin/messages', { messages, unreadCount });
}));

// Mark as read
router.post('/:id/read', ...adminOnly, catchAsync(async (req, res) => {
    await VisitorMessage.findByIdAndUpdate(req.params.id, { isRead: true });
    res.redirect('/admin/messages');
}));

// Mark as unread
router.post('/:id/unread', ...adminOnly, catchAsync(async (req, res) => {
    await VisitorMessage.findByIdAndUpdate(req.params.id, { isRead: false });
    res.redirect('/admin/messages');
}));

// Delete
router.delete('/:id', ...adminOnly, catchAsync(async (req, res) => {
    await VisitorMessage.findByIdAndDelete(req.params.id);
    req.flash('success', 'Message supprimé.');
    res.redirect('/admin/messages');
}));

module.exports = router;
