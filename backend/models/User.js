const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName:   { type: String, required: true, trim: true },
  lastName:    { type: String, required: true, trim: true },
  email:       { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:    { type: String, required: true, minlength: 8 },
  isAdmin:     { type: Boolean, default: false },
  memberSince: { type: Date, default: Date.now },
  address: {
    street:  { type: String, default: '' },
    zip:     { type: String, default: '' },
    city:    { type: String, default: '' },
    country: { type: String, default: 'France' },
  },
  newsletterSubscribed: { type: Boolean, default: false },
}, { timestamps: true });

// Hash password before save (Mongoose 9 — async hooks don't receive next)
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// Compare password
userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// Never return password in JSON
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
