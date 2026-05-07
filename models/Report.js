const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, required: true },
  generatedAt: { type: Date, default: Date.now },
  generatedBy: { type: String, required: true },
  format: { type: String, enum: ['PDF', 'Excel', 'CSV'], required: true },
  fileUrl: { type: String },
  status: { type: String, enum: ['ready', 'processing', 'failed'], default: 'ready' }
});

module.exports = mongoose.model('Report', reportSchema); 