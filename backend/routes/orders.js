const express = require('express');
const Order   = require('../models/Order');
const Product = require('../models/Product');
const authMw  = require('../middleware/auth');
const adminMw = require('../middleware/admin');

const router = express.Router();

// ── POST /api/orders ───────────────────────────────────────────────────────
// Create order (authenticated user)
router.post('/', authMw, async (req, res) => {
  try {
    const { items, promoCode, shipping_address, payment } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'Le panier est vide.' });
    }

    // Validate products and compute totals
    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product || !product.active) {
        return res.status(400).json({ message: `Produit introuvable : ${item.productId}` });
      }
      if (product.stock < item.quantity) {
        return res.status(400).json({ message: `Stock insuffisant pour : ${product.name}` });
      }
      subtotal += product.price * item.quantity;
      orderItems.push({
        product:  product._id,
        name:     product.name,
        price:    product.price,
        quantity: item.quantity,
        img:      product.img,
      });
    }

    // Apply promo codes server-side
    const PROMO_CODES = {
      VAULT10:     { type: 'percent', value: 10 },
      HOLO20:      { type: 'percent', value: 20 },
      GOLD5:       { type: 'fixed',   value: 5  },
      NEWSLETTER5: { type: 'percent', value: 5  },
    };
    let discount = 0;
    if (promoCode && PROMO_CODES[promoCode.toUpperCase()]) {
      const promo = PROMO_CODES[promoCode.toUpperCase()];
      discount = promo.type === 'percent'
        ? Math.round(subtotal * promo.value) / 100
        : promo.value;
    }

    const shippingCost = subtotal >= 150 ? 0 : 5.99;
    const total = Math.max(0, subtotal - discount + shippingCost);

    const order = await Order.create({
      user: req.user._id,
      items: orderItems,
      subtotal,
      discount,
      shipping: shippingCost,
      total,
      promoCode: promoCode || '',
      shipping_address,
      payment,
    });

    // Decrement stock
    for (const item of items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: -item.quantity },
      });
    }

    res.status(201).json({ order });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
});

// ── GET /api/orders/mine ───────────────────────────────────────────────────
// Get current user's orders
router.get('/mine', authMw, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .populate('items.product', 'name img');
    res.json({ orders });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
});

// ── GET /api/orders/:id ────────────────────────────────────────────────────
// Get single order (owner or admin)
router.get('/:id', authMw, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('items.product', 'name img');
    if (!order) return res.status(404).json({ message: 'Commande introuvable.' });
    if (!req.user.isAdmin && order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Accès refusé.' });
    }
    res.json({ order });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
});

// ── GET /api/orders ────────────────────────────────────────────────────────
// Admin — all orders
router.get('/', authMw, adminMw, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = status ? { status } : {};
    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate('user', 'firstName lastName email');
    const total = await Order.countDocuments(filter);
    res.json({ orders, total, page: Number(page) });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
});

// ── PATCH /api/orders/:id/status ──────────────────────────────────────────
// Admin — update order status
router.patch('/:id/status', authMw, adminMw, async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: 'Statut invalide.' });
    }
    const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!order) return res.status(404).json({ message: 'Commande introuvable.' });
    res.json({ order });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
});

module.exports = router;
