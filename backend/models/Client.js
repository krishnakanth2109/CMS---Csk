import mongoose from 'mongoose';

const clientSchema = mongoose.Schema({
  clientId: {
    type: String,
    unique: true,
  },
  companyName: {
    type: String,
    required: true,
  },
  contactPerson: {
    type: String,
  },
  email: {
    type: String,
  },
  phone: {
    type: String,
  },
  website: {
    type: String,
  },
  address: {
    type: String,
  },
  // New Field
  clientLocation: {
    type: String,
  },
  industry: {
    type: String,
  },
  gstNumber: {
    type: String,
  },
  notes: {
    type: String,
  },
  percentage: {
    type: String, // Commission %
  },
  candidatePeriod: {
    type: String,
  },
  replacementPeriod: {
    type: String,
  },
  // New Field
  lockingPeriod: {
    type: String,
  },
  // New Field
  paymentMode: {
    type: String,
  },
  terms: {
    type: String,
  },
  active: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

const Client = mongoose.model('Client', clientSchema);

export default Client;