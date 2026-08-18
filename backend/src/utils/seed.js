require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize, User } = require('../models');

async function seed() {
  await sequelize.sync();

  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@byinkshealth.com').toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'BYINKSHEALTH-99';

  const existingAdmin = await User.findOne({ where: { email: adminEmail } });
  if (!existingAdmin) {
    await User.create({
      name: 'System Admin',
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 10),
      role: 'ADMIN',
      isApproved: true,
      isOnline: false,
    });
    console.log(`[seed] Created admin account: ${adminEmail}`);
  } else {
    console.log('[seed] Admin account already exists, skipping');
  }

  const demoAccounts = [
    { name: 'Dr. Ada Obi', email: 'consultant@byinkshealth.com', role: 'CONSULTANT', specialty: 'General Practice', isApproved: true },
    { name: 'City Pharmacy', email: 'pharmacy@byinkshealth.com', role: 'PHARMACY', isApproved: true },
    { name: 'Dispatch Rider 1', email: 'dispatch@byinkshealth.com', role: 'DISPATCH', isApproved: true },
    { name: 'Demo Patient', email: 'patient@byinkshealth.com', role: 'PATIENT', isApproved: true },
  ];

  for (const acc of demoAccounts) {
    const existing = await User.findOne({ where: { email: acc.email } });
    if (existing) continue;
    await User.create({
      ...acc,
      passwordHash: await bcrypt.hash('Password123!', 10),
      isOnline: false,
    });
    console.log(`[seed] Created ${acc.role} account: ${acc.email} (password: Password123!)`);
  }

  console.log('[seed] Done.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('[seed] Failed:', err);
  process.exit(1);
});
