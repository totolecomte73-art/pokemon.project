require('dotenv').config();

const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');

const authRoutes    = require('./routes/auth');
const productRoutes = require('./routes/products');
const orderRoutes   = require('./routes/orders');
const paymentRoutes = require('./routes/payment');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.CLIENT_URL,            // GitHub Pages
  'http://localhost:3000',           // local dev (React etc.)
  'http://localhost:5500',           // Live Server VSCode
  'http://127.0.0.1:5500',
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (Postman, curl, server-to-server)
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS bloqué pour l'origine : ${origin}`));
  },
  credentials: true,
}));

// ── Body parsers ─────────────────────────────────────────────────────────────
// Stripe webhook needs raw body — register BEFORE express.json()
app.use('/api/payment/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders',   orderRoutes);
app.use('/api/payment',  paymentRoutes);

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

// ── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: `Route introuvable : ${req.method} ${req.path}` });
});

// ── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ message: err.message || 'Erreur serveur.' });
});

// ── MongoDB + seed admin ─────────────────────────────────────────────────────
async function seedAdmin() {
  const User = require('./models/User');
  const existing = await User.findOne({ email: 'admin@pokevault.com' });
  if (!existing) {
    await User.create({
      firstName: 'Admin',
      lastName:  'PokeVault',
      email:     'admin@pokevault.com',
      password:  'PokéVault2024!',
      isAdmin:   true,
    });
    console.log('✅ Compte admin créé : admin@pokevault.com');
  }
}

mongoose
  .connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('✅ MongoDB connecté');
    await seedAdmin();
    app.listen(PORT, () => {
      console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Erreur MongoDB :', err.message);
    process.exit(1);
  });
