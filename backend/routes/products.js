const express  = require('express');
const Product  = require('../models/Product');
const authMw   = require('../middleware/auth');
const adminMw  = require('../middleware/admin');

const router = express.Router();

// ── GET /api/products ──────────────────────────────────────────────────────
// Public — list all active products (with optional filters)
router.get('/', async (req, res) => {
  try {
    const { type, rarity, minPrice, maxPrice, search, sort } = req.query;
    const filter = { active: true };

    if (type)   filter.type   = type;
    if (rarity) filter.rarity = rarity;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }
    if (search) filter.$text = { $search: search };

    const sortMap = {
      price_asc:  { price:  1 },
      price_desc: { price: -1 },
      name_asc:   { name:   1 },
      newest:     { createdAt: -1 },
    };
    const sortOpt = sortMap[sort] || { createdAt: -1 };

    const products = await Product.find(filter).sort(sortOpt);
    res.json({ products });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
});

// ── GET /api/products/:id ──────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product || !product.active) {
      return res.status(404).json({ message: 'Produit introuvable.' });
    }
    res.json({ product });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
});

// ── POST /api/products ─────────────────────────────────────────────────────
// Admin only — create product
router.post('/', authMw, adminMw, async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json({ product });
  } catch (err) {
    res.status(400).json({ message: 'Données invalides.', error: err.message });
  }
});

// ── PUT /api/products/:id ──────────────────────────────────────────────────
// Admin only — update product
router.put('/:id', authMw, adminMw, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!product) return res.status(404).json({ message: 'Produit introuvable.' });
    res.json({ product });
  } catch (err) {
    res.status(400).json({ message: 'Données invalides.', error: err.message });
  }
});

// ── DELETE /api/products/:id ───────────────────────────────────────────────
// Admin only — soft delete (active: false)
router.delete('/:id', authMw, adminMw, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { active: false },
      { new: true }
    );
    if (!product) return res.status(404).json({ message: 'Produit introuvable.' });
    res.json({ message: 'Produit désactivé.', product });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
});

// ── PATCH /api/products/:id/stock ─────────────────────────────────────────
// Admin only — update stock only
router.patch('/:id/stock', authMw, adminMw, async (req, res) => {
  try {
    const { stock } = req.body;
    if (stock === undefined || stock < 0) {
      return res.status(400).json({ message: 'Stock invalide.' });
    }
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { stock },
      { new: true }
    );
    if (!product) return res.status(404).json({ message: 'Produit introuvable.' });
    res.json({ product });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
});

module.exports = router;
