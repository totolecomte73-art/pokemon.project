const mongoose = require('mongoose');

const newsletterSchema = new mongoose.Schema({
  email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
  promoCode: { type: String, required: true, unique: true },
  used:      { type: Boolean, default: false },
  active:    { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Newsletter', newsletterSchema);
