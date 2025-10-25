const adminService = require('../services/adminService');

/**
 * Admin login endpoint
 * POST /admin/login
 */
exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await adminService.adminLogin({ email, password });

    if (!result.success) {
      return res.status(401).json({
        error: result.error
      });
    }

    res.json({
      message: result.message,
      user: result.user,
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken
    });

  } catch (error) {
    console.error('Admin login controller error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};

/**
 * Create admin endpoint (for super admin use)
 * POST /admin/create
 */
exports.createAdmin = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    const result = await adminService.createAdmin({ email, password, name });

    if (!result.success) {
      return res.status(400).json({
        error: result.error
      });
    }

    res.status(201).json({
      message: result.message,
      admin: result.admin
    });

  } catch (error) {
    console.error('Create admin controller error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};

/**
 * Get admin profile endpoint
 * GET /admin/profile
 */
exports.getAdminProfile = async (req, res) => {
  try {
    const adminId = req.user.id; // From JWT middleware

    const result = await adminService.getAdminProfile(adminId);

    if (!result.success) {
      return res.status(404).json({
        error: result.error
      });
    }

    res.json({
      admin: result.admin
    });

  } catch (error) {
    console.error('Get admin profile controller error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};

/**
 * Update admin password endpoint
 * PUT /admin/password
 */
exports.updateAdminPassword = async (req, res) => {
  try {
    const adminId = req.user.id; // From JWT middleware
    const { currentPassword, newPassword } = req.body;

    const result = await adminService.updateAdminPassword(adminId, currentPassword, newPassword);

    if (!result.success) {
      return res.status(400).json({
        error: result.error
      });
    }

    res.json({
      message: result.message
    });

  } catch (error) {
    console.error('Update admin password controller error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};
