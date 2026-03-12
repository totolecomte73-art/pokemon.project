const express    = require('express');
const router     = express.Router();
const Newsletter = require('../models/Newsletter');
const nodemailer = require('nodemailer');
const protect   = require('../middleware/auth');
const adminOnly = require('../middleware/admin');

// ── Generate unique promo code ────────────────────────────────────────────────
function generatePromoCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'NL-';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ── Send confirmation email ───────────────────────────────────────────────────
async function sendConfirmationEmail(email, promoCode) {
  // If no email credentials configured, skip silently
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log(`📧 Email skipped (no credentials) — promo code for ${email}: ${promoCode}`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host:   process.env.EMAIL_HOST || 'smtp.gmail.com',
    port:   parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_PORT === '465',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from:    `"PokéVault" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
    to:      email,
    subject: '🎁 Votre code promo -5% PokéVault',
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0d0d1a;color:#e0e0e0;padding:32px;border-radius:12px;">
        <h1 style="color:#f5c518;text-align:center;">⚡ Bienvenue chez PokéVault !</h1>
        <p>Merci de vous être inscrit(e) à notre newsletter.</p>
        <p>Votre code promo exclusif <strong>-5%</strong> sur votre prochaine commande :</p>
        <div style="background:#1a1a2e;border:2px solid #f5c518;border-radius:8px;padding:16px;text-align:center;margin:24px 0;">
          <span style="font-size:28px;font-weight:bold;letter-spacing:4px;color:#f5c518;">${promoCode}</span>
        </div>
        <p style="font-size:13px;color:#888;">Ce code est valable une fois. À saisir lors du paiement.</p>
        <p style="font-size:13px;color:#888;margin-top:32px;">L'équipe PokéVault</p>
      </div>
    `,
  });
}

// ── POST /api/newsletter — subscribe ─────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Email invalide.' });
    }

    // Check if already subscribed
    const existing = await Newsletter.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({
        message: 'Cet email est déjà inscrit à la newsletter.',
        promoCode: existing.promoCode,
        alreadySubscribed: true,
      });
    }

    // Generate unique promo code
    let promoCode;
    let attempts = 0;
    do {
      promoCode = generatePromoCode();
      attempts++;
    } while (await Newsletter.findOne({ promoCode }) && attempts < 10);

    const subscriber = await Newsletter.create({ email: email.toLowerCase(), promoCode });

    // Send email (non-blocking)
    sendConfirmationEmail(email.toLowerCase(), promoCode).catch(err =>
      console.error('Email error:', err.message)
    );

    res.status(201).json({
      message: 'Inscription réussie ! Votre code promo vous a été envoyé par email.',
      promoCode,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// ── GET /api/newsletter — admin: list all subscribers ────────────────────────
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const page  = parseInt(req.query.page  || '1');
    const limit = parseInt(req.query.limit || '50');
    const skip  = (page - 1) * limit;

    const [subscribers, total] = await Promise.all([
      Newsletter.find().sort({ createdAt: -1 }).skip(skip).limit(limit).select('-__v'),
      Newsletter.countDocuments(),
    ]);

    res.json({ subscribers, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// ── DELETE /api/newsletter/:id — admin: unsubscribe ───────────────────────────
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    await Newsletter.findByIdAndDelete(req.params.id);
    res.json({ message: 'Désabonnement effectué.' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

module.exports = router;
