const platformSettingsService = require('../services/platformSettingsService');
const paymentService = require('../services/paymentService');

exports.getPlatformSettings = async (req, res) => {
  try {
    const data = await platformSettingsService.getSettings();
    res.json({ success: true, data });
  } catch (error) {
    console.error('Get platform settings error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.updatePlatformSettings = async (req, res) => {
  try {
    const data = await platformSettingsService.updateSettings(req.body || {});
    res.json({ success: true, data, message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Update platform settings error:', error);
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.getPayments = async (req, res) => {
  try {
    const { page = 1, limit = 10, status = 'all' } = req.query;
    const result = await paymentService.getPaymentsForAdmin(
      parseInt(page, 10),
      parseInt(limit, 10),
      String(status).toLowerCase()
    );
    res.json(result);
  } catch (error) {
    console.error('Admin get payments error:', error);
    res.status(400).json({ error: error.message });
  }
};

exports.processDailyPayments = async (req, res) => {
  try {
    const result = await paymentService.processDailyPayments();
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Process daily payments error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to process daily payments',
    });
  }
};
