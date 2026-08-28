const bcrypt = require('bcryptjs');
const { User } = require('../models');

async function getConsultants(req, res) {
  try {
    const consultants = await User.findAll({
      where: {
        role: 'CONSULTANT',
        isApproved: true,
      },
      attributes: [
        'id',
        'name',
        'email',
        'role',
        'specialty',
        'avatar',
        'isApproved',
        'isOnline'
      ],
    });

    res.json(consultants);
  } catch (error) {
    console.error('Get consultants error:', error);

    res.status(500).json({
      error: 'Failed to fetch consultants',
      message: error.message,
    });
  }
}
async function getAllUsers(req, res) {
  const users = await User.findAll({ order: [['createdAt', 'ASC']] });
  res.json(users.map((u) => u.toPublicJSON()));
}

async function getProfile(req, res) {
  const user = await User.findByPk(req.params.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user.toPublicJSON());
}

async function updateProfile(req, res) {
  try {
    // Consultants should only be able to edit themselves.
    // Use the authenticated user's ID from the JWT.
    const userId =
      req.user.role === 'ADMIN'
        ? req.params.userId
        : req.user.id;

    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    const {
      password,
      passwordHash,
      email,
      role,
      id,
      location,
      ...rest
    } = req.body;

    // Convert location object into database fields
    if (location) {
      rest.locationLat = location.lat;
      rest.locationLng = location.lng;
    }

    await user.update(rest);

    return res.json(user.toPublicJSON());

  } catch (error) {
    console.error('Update profile error:', error);

    return res.status(500).json({
      error: 'Failed to update profile',
      message: error.message
    });
  }
}

async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Current password and new password are required',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        error: 'New password must be at least 6 characters',
      });
    }
      const user = await User.scope('withPassword').findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
      });
    }

    const passwordMatches = await bcrypt.compare(
      currentPassword,
      user.passwordHash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        error: 'Current password is incorrect',
      });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    await user.update({
      passwordHash: newPasswordHash,
    });

    return res.json({
      success: true,
      message: 'Password changed successfully',
    });

  } catch (error) {
    console.error('Change password error:', error);

    return res.status(500).json({
      error: 'Failed to change password',
      message: error.message,
    });
  }
}
// Admin: create a user directly (e.g. seeding a pharmacy/dispatch account)
async function adminCreateUser(req, res) {
  const { name, email, password, role, ...profileFields } = req.body;
  if (!name || !email || !role) {
    return res.status(400).json({ error: 'name, email and role are required' });
  }
  const existing = await User.findOne({ where: { email: email.toLowerCase().trim() } });
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const passwordHash = await bcrypt.hash(password || Math.random().toString(36).slice(2), 10);
  const user = await User.create({
    name, email, passwordHash, role, isApproved: true, isOnline: true, ...profileFields,
  });
  res.status(201).json(user.toPublicJSON());
}

async function removeUser(req, res) {
  const user = await User.findByPk(req.params.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  await user.destroy();
  res.json({ success: true });
}

// Approve/reject consultants, pharmacies, dispatch riders; toggle online status, etc.
async function updateUserStatus(req, res) {
  const user = await User.findByPk(req.params.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { isApproved, isOnline, ...rest } = req.body;
  const updates = { ...rest };
  if (isApproved !== undefined) updates.isApproved = isApproved;
  if (isOnline !== undefined) updates.isOnline = isOnline;
  await user.update(updates);
  res.json(user.toPublicJSON());
}

async function updateOnlineStatus(req, res) {
  try {
    const user = await User.findByPk(req.params.userId);

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // User can only change their own status unless they're an admin
    if (
      req.user.id !== user.id &&
      req.user.role !== 'ADMIN'
    ) {
      return res.status(403).json({
        error: 'Forbidden'
      });
    }

    const { isOnline } = req.body;

    if (typeof isOnline !== 'boolean') {
      return res.status(400).json({
        error: 'isOnline must be true or false'
      });
    }

    await user.update({ isOnline });

    res.json({
      success: true,
      isOnline: user.isOnline
    });

  } catch (error) {
    console.error('Update online status error:', error);

    res.status(500).json({
      error: 'Failed to update online status',
      message: error.message
    });
  }
}

module.exports = {
  getAllUsers,
  getConsultants,
  getProfile,
  updateProfile,
  adminCreateUser,
  removeUser,
  updateUserStatus,
  updateOnlineStatus,
  changePassword,
};
