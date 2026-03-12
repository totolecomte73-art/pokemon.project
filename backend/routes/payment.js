const express = require('express');
const stripe  = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Order   = require('../models/Order');
const authMw  = require('../middleware/auth');

const router = express.Router();

// ── POST /api/payment/create-intent ───────────────────────────────────────
// Create a Stripe PaymentIntent — returns clientSecret to the frontend
router.post('/create-intent', authMw, async (req, res) => {
  try {
    const { items, promoCode } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'Panier vide.' });
    }

    // Compute amount server-side (never trust client-side amount)
    const Product = require('../models/Product');
    let subtotal = 0;
    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) return res.status(400).json({ message: `Produit introuvable : ${item.productId}` });
      subtotal += product.price * item.quantity;
    }

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
        ? subtotal * promo.value / 100
        : promo.value;
    }

    const shippingCost = subtotal >= 150 ? 0 : 5.99;
    const total = Math.max(0, subtotal - discount + shippingCost);
    const amountCents = Math.round(total * 100); // Stripe expects cents

    const paymentIntent = await stripe.paymentIntents.create({
      amount:   amountCents,
      currency: 'eur',
      metadata: {
        userId:    req.user._id.toString(),
        promoCode: promoCode || '',
      },
    });

    res.json({ clientSecret: paymentIntent.client_secret, amount: total });
  } catch (err) {
    res.status(500).json({ message: 'Erreur Stripe.', error: err.message });
  }
});

// ── POST /api/payment/webhook ──────────────────────────────────────────────
// Stripe webhook — confirm payment and mark order as paid
// Must be registered with raw body parser (see server.js)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).json({ message: `Webhook Error: ${err.message}` });
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object;
    // Mark matching order as paid
    await Order.findOneAndUpdate(
      { 'payment.stripePaymentId': pi.id },
      {
        status: 'paid',
        'payment.paidAt': new Date(),
      }
    );
  }

  res.json({ received: true });
});

module.exports = router;
