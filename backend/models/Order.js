const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product:  { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name:     { type: String, required: true },
  price:    { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
  img:      { type: String, default: '' },
}, { _id: false });

const orderSchema = new mongoose.Schema({
  user:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items:    [orderItemSchema],
  subtotal: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  shipping: { type: Number, default: 0 },
  total:    { type: Number, required: true },
  promoCode: { type: String, default: '' },

  status: {
    type: String,
    enum: ['pending', 'paid', 'shipped', 'delivered', 'cancelled'],
    default: 'pending',
  },

  payment: {
    method:          { type: String, default: 'stripe' },
    stripePaymentId: { type: String, default: '' },
    paidAt:          { type: Date },
  },

  shipping_address: {
    firstName: String,
    lastName:  String,
    street:    String,
    zip:       String,
    city:      String,
    country:   { type: String, default: 'France' },
  },

  orderRef: { type: String, unique: true },
}, { timestamps: true });

// Generate order reference before save
orderSchema.pre('save', function (next) {
  if (!this.orderRef) {
    const year = new Date().getFullYear();
    const rand = String(Math.floor(Math.random() * 90000) + 10000);
    this.orderRef = `PV-${year}-${rand}`;
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);
