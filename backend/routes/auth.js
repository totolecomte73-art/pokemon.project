const express = require('express');
const jwt     = require('jsonwebtoken');
const User    = require('../models/User');
const authMw  = require('../middleware/auth');

const router = express.Router();

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

// ── POST /api/auth/register ────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: 'Tous les champs sont requis.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Le mot de passe doit faire au moins 8 caractères.' });
    }
    if (email.toLowerCase() === 'admin@pokevault.com') {
      return res.status(400).json({ message: 'Cet email est réservé.' });
    }

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(409).json({ message: 'Cet email est déjà utilisé.' });

    const user  = await User.create({ firstName, lastName, email, password });
    const token = signToken(user._id);

    res.status(201).json({ token, user });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
});

// ── POST /api/auth/login ───────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email et mot de passe requis.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) return res.status(401).json({ message: 'Aucun compte avec cet email.' });

    const valid = await user.comparePassword(password);
    if (!valid) return res.status(401).json({ message: 'Mot de passe incorrect.' });

    const token = signToken(user._id);
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
});

// ── GET /api/auth/me ───────────────────────────────────────────────────────
router.get('/me', authMw, (req, res) => {
  res.json({ user: req.user });
});

// ── PUT /api/auth/profile ──────────────────────────────────────────────────
router.put('/profile', authMw, async (req, res) => {
  try {
    const { firstName, lastName, address } = req.body;
    const updates = {};
    if (firstName) updates.firstName = firstName;
    if (lastName)  updates.lastName  = lastName;
    if (address)   updates.address   = address;

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
});

// ── PUT /api/auth/password ─────────────────────────────────────────────────
router.put('/password', authMw, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ message: '8 caractères minimum.' });
    }

    const user = await User.findById(req.user._id).select('+password');
    const valid = await user.comparePassword(currentPassword);
    if (!valid) return res.status(401).json({ message: 'Mot de passe actuel incorrect.' });

    user.password = newPassword;
    await user.save();
    res.json({ message: 'Mot de passe mis à jour.' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
  }
});

module.exports = router;
