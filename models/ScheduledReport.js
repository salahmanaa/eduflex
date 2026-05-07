const mongoose = require('mongoose');

const scheduledReportSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, required: true },
  frequency: { type: String, enum: ['Quotidien', 'Hebdomadaire', 'Mensuel', 'Trimestriel'], required: true },
  nextRun: { type: Date, required: true },
  recipients: [{ type: String, required: true }],
  format: { type: String, enum: ['PDF', 'Excel', 'CSV'], required: true },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ScheduledReport', scheduledReportSchema); 