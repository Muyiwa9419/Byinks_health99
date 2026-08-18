const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { signToken } = require('../utils/jwt');

// Roles that are auto-approved on signup; consultants/pharmacy/dispatch need admin approval
const AUTO_APPROVED_ROLES = ['PATIENT', 'ADMIN'];

async function signUp(req, res) {
  const { name, email, password, role, ...profileFields } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({
      error: 'name, email, password and role are required'
    });
  }

  const existing = await User.findOne({
    where: {
      email: email.toLowerCase().trim()
    }
  });

  if (existing) {
    return res.status(409).json({
      error: 'Email already registered'
    });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const isApproved = AUTO_APPROVED_ROLES.includes(role);

  const user = await User.create({
    name,
    email: email.toLowerCase().trim(),
    passwordHash,
    role,
    isApproved,
    isOnline: false,
    ...profileFields,
  });

  // Consultants, pharmacy and dispatch accounts
  // must wait for admin approval.
  if (!isApproved) {
    return res.status(201).json({
      user: user.toPublicJSON(),
      approved: false,
      message:
        'Registration successful. Your account is awaiting administrator approval.'
    });
  }

  // Auto-approved users can receive a token immediately.
  const token = signToken(user);

  res.status(201).json({
    user: user.toPublicJSON(),
    approved: true,
    token
  });
}


async function signIn(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: 'email and password are required'
    });
  }

  const user = await User.scope('withPassword').findOne({
    where: {
      email: email.toLowerCase().trim()
    }
  });

  if (!user) {
    return res.status(404).json({
      error: 'Identity not found in clinical registry.'
    });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);

  if (!valid) {
    return res.status(401).json({
      error: 'Clinical Alert: Invalid Authenticator Key.'
    });
  }

  // IMPORTANT:
  // Consultants, pharmacy and dispatch users cannot log in
  // until an administrator approves their account.
  if (!user.isApproved) {
    return res.status(403).json({
      error: 'Your account is awaiting administrator approval.',
      code: 'ACCOUNT_NOT_APPROVED',
      isApproved: false
    });
  }

  user.isOnline = true;
  await user.save();

  const token = signToken(user);

  res.json({
    user: user.toPublicJSON(),
    token
  });
}

async function signOut(req, res) {
  req.user.isOnline = false;
  await req.user.save();
  res.json({ success: true });
}

async function me(req, res) {
  res.json({ user: req.user.toPublicJSON() });
}

module.exports = { signUp, signIn, signOut, me };
