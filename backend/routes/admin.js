const express    = require('express');
const router     = express.Router();
const User       = require('../models/User');
const Order      = require('../models/Order');
const Newsletter = require('../models/Newsletter');
const protect   = require('../middleware/auth');
const adminOnly = require('../middleware/admin');

// All admin routes require auth + admin role
router.use(protect, adminOnly);

// ── GET /api/admin/users ──────────────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const page    = parseInt(req.query.page  || '1');
    const limit   = parseInt(req.query.limit || '50');
    const skip    = (page - 1) * limit;
    const search  = req.query.search || '';

    const filter = search
      ? { $or: [
          { email:     { $regex: search, $options: 'i' } },
          { firstName: { $regex: search, $options: 'i' } },
          { lastName:  { $regex: search, $options: 'i' } },
        ]}
      : {};

    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit)
          .select('-password -__v'),
      User.countDocuments(filter),
    ]);

    res.json({ users, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// ── GET /api/admin/stats ──────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [
      totalUsers,
      totalOrders,
      totalNewsletter,
      revenueAgg,
      recentOrders,
    ] = await Promise.all([
      User.countDocuments({ isAdmin: false }),
      Order.countDocuments(),
      Newsletter.countDocuments({ active: true }),
      Order.aggregate([
        { $match: { status: { $in: ['paid', 'shipped', 'delivered'] } } },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),
      Order.find().sort({ createdAt: -1 }).limit(5)
           .populate('user', 'firstName lastName email')
           .select('orderRef total status createdAt'),
    ]);

    res.json({
      totalUsers,
      totalOrders,
      totalNewsletter,
      totalRevenue: revenueAgg[0]?.total || 0,
      recentOrders,
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// ── PATCH /api/admin/users/:id/toggle-admin ───────────────────────────────────
router.patch('/users/:id/toggle-admin', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable.' });
    if (user.email === 'admin@pokevault.com') {
      return res.status(403).json({ message: 'Impossible de modifier le super admin.' });
    }
    user.isAdmin = !user.isAdmin;
    await user.save();
    res.json({ message: 'Rôle mis à jour.', isAdmin: user.isAdmin });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

module.exports = router;
