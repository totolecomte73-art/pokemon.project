const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  emoji:       { type: String, default: '🃏' },
  img:         { type: String, default: '' },
  type:        { type: String, required: true },
  rarity:      { type: String, required: true },
  extension:   { type: String, default: '' },
  price:       { type: Number, required: true, min: 0 },
  condition:   { type: String, default: 'Near Mint' },
  stock:       { type: Number, default: 0, min: 0 },
  hp:          { type: Number, default: 0 },
  attacks: [{
    name: { type: String },
    dmg:  { type: Number },
  }],
  badges:      [{ type: String }],
  description: { type: String, default: '' },
  active:      { type: Boolean, default: true },
}, { timestamps: true });

productSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('Product', productSchema);
