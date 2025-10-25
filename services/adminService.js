const User = require('../models/user');
const bcrypt = require('bcrypt');
const generateToken = require('../utils/generate-token');

/**
 * Admin login with email and password
 * @param {string} email - Admin email
 * @param {string} password - Admin password
 * @returns {Object} - Login result with token and user info
 */
async function adminLogin({ email, password }) {
  try {
    // Validate input
    if (!email || !password) {
      return {
        success: false,
        error: 'Email and password are required'
      };
    }

    // Find admin user by email and type
    const admin = await User.findOne({
      where: {
        email: email.toLowerCase().trim(),
        type: 'admin'
      }
    });

    if (!admin) {
      return {
        success: false,
        error: 'Invalid email or password'
      };
    }

    // Check if admin has a password set
    if (!admin.password) {
      return {
        success: false,
        error: 'Admin account not properly configured'
      };
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    
    if (!isPasswordValid) {
      return {
        success: false,
        error: 'Invalid email or password'
      };
    }

    // Check if admin is approved
    if (admin.approval_status !== 1) {
      return {
        success: false,
        error: 'Admin account not approved'
      };
    }

    // Generate tokens
    const tokens = generateToken({
      id: admin.id,
      email: admin.email,
      type: admin.type,
      name: admin.name
    });

    // Return success with user info (excluding sensitive data)
    return {
      success: true,
      message: 'Admin login successful',
      user: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        type: admin.type,
        approval_status: admin.approval_status,
        date_created: admin.date_created
      },
      tokens
    };

  } catch (error) {
    console.error('Admin login error:', error);
    return {
      success: false,
      error: 'Internal server error during admin login'
    };
  }
}

/**
 * Create a new admin account
 * @param {Object} adminData - Admin account data
 * @returns {Object} - Creation result
 */
async function createAdmin({ email, password, name }) {
  try {
    // Validate input
    if (!email || !password || !name) {
      return {
        success: false,
        error: 'Email, password, and name are required'
      };
    }

    // Check if admin already exists
    const existingAdmin = await User.findOne({
      where: {
        email: email.toLowerCase().trim(),
        type: 'admin'
      }
    });

    if (existingAdmin) {
      return {
        success: false,
        error: 'Admin with this email already exists'
      };
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create admin user
    const admin = await User.create({
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      name: name.trim(),
      type: 'admin',
      approval_status: 1, // Auto-approve admin accounts
      date_created: new Date()
    });

    return {
      success: true,
      message: 'Admin account created successfully',
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        type: admin.type,
        approval_status: admin.approval_status,
        date_created: admin.date_created
      }
    };

  } catch (error) {
    console.error('Create admin error:', error);
    return {
      success: false,
      error: 'Internal server error during admin creation'
    };
  }
}

/**
 * Get admin profile by ID
 * @param {number} adminId - Admin ID
 * @returns {Object} - Admin profile
 */
async function getAdminProfile(adminId) {
  try {
    const admin = await User.findOne({
      where: {
        id: adminId,
        type: 'admin'
      },
      attributes: ['id', 'email', 'name', 'type', 'approval_status', 'date_created']
    });

    if (!admin) {
      return {
        success: false,
        error: 'Admin not found'
      };
    }

    return {
      success: true,
      admin
    };

  } catch (error) {
    console.error('Get admin profile error:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}

/**
 * Update admin password
 * @param {number} adminId - Admin ID
 * @param {string} currentPassword - Current password
 * @param {string} newPassword - New password
 * @returns {Object} - Update result
 */
async function updateAdminPassword(adminId, currentPassword, newPassword) {
  try {
    // Validate input
    if (!currentPassword || !newPassword) {
      return {
        success: false,
        error: 'Current password and new password are required'
      };
    }

    // Find admin
    const admin = await User.findOne({
      where: {
        id: adminId,
        type: 'admin'
      }
    });

    if (!admin) {
      return {
        success: false,
        error: 'Admin not found'
      };
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, admin.password);
    
    if (!isCurrentPasswordValid) {
      return {
        success: false,
        error: 'Current password is incorrect'
      };
    }

    // Hash new password
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await admin.update({
      password: hashedNewPassword
    });

    return {
      success: true,
      message: 'Password updated successfully'
    };

  } catch (error) {
    console.error('Update admin password error:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}

module.exports = {
  adminLogin,
  createAdmin,
  getAdminProfile,
  updateAdminPassword
};
