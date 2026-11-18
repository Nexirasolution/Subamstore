/**
 * Run with: npm run seed
 * Creates the first admin account, default categories (kids dress),
 * and default store settings. Safe to re-run - it skips items that already exist.
 */
require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const slugify = require('slugify');

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('Missing MONGODB_URI in .env. Add your MongoDB Atlas connection string first.');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const AdminSchema = new mongoose.Schema({ name: String, email: { type: String, unique: true }, passwordHash: String, role: String }, { timestamps: true });
  const CategorySchema = new mongoose.Schema({ name: String, slug: { type: String, unique: true }, image: String, description: String, sizes: [String], sortOrder: Number, isActive: Boolean }, { timestamps: true });
  const SettingsSchema = new mongoose.Schema({ key: { type: String, unique: true } }, { strict: false, timestamps: true });

  const Admin = mongoose.models.Admin || mongoose.model('Admin', AdminSchema);
  const Category = mongoose.models.Category || mongoose.model('Category', CategorySchema);
  const Settings = mongoose.models.Settings || mongoose.model('Settings', SettingsSchema);

  // 1. Admin account
  const email = (process.env.ADMIN_EMAIL || 'subhamstores2026@gmail.com').toLowerCase();
  const existingAdmin = await Admin.findOne({ email });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'ChangeMe123!', 10);
    await Admin.create({ name: 'Admin', email, passwordHash, role: 'owner' });
    console.log(`Created admin account: ${email}`);
  } else {
    console.log('Admin account already exists, skipping.');
  }

  // 2. Categories (Kids dress)
  const categories = [
    { name: 'Boys Wear', sizes: ['0-1 Yr', '1-2 Yrs', '2-3 Yrs', '3-4 Yrs', '4-5 Yrs', '5-6 Yrs', '6-7 Yrs', '7-8 Yrs'] },
    { name: 'Girls Frocks', sizes: ['0-1 Yr', '1-2 Yrs', '2-3 Yrs', '3-4 Yrs', '4-5 Yrs', '5-6 Yrs', '6-7 Yrs', '7-8 Yrs'] },
    { name: 'Party Wear', sizes: ['1-2 Yrs', '2-3 Yrs', '3-4 Yrs', '4-5 Yrs', '5-6 Yrs', '6-7 Yrs', '7-8 Yrs'] },
    { name: 'Ethnic Wear', sizes: ['1-2 Yrs', '2-3 Yrs', '3-4 Yrs', '4-5 Yrs', '5-6 Yrs', '6-7 Yrs', '7-8 Yrs'] },
    { name: 'T-Shirts & Shorts', sizes: ['1-2 Yrs', '2-3 Yrs', '3-4 Yrs', '4-5 Yrs', '5-6 Yrs', '6-7 Yrs', '7-8 Yrs'] },
    { name: 'Night Wear', sizes: ['1-2 Yrs', '2-3 Yrs', '3-4 Yrs', '4-5 Yrs', '5-6 Yrs', '6-7 Yrs', '7-8 Yrs'] },
    { name: 'Baby Wear', sizes: ['0-3 Months', '3-6 Months', '6-9 Months', '9-12 Months'] },
    { name: 'Innerwear', sizes: ['S', 'M', 'L', 'XL'] }
  ];

  for (let i = 0; i < categories.length; i++) {
    const c = categories[i];
    const slug = slugify(c.name, { lower: true });
    const exists = await Category.findOne({ slug });
    if (!exists) {
      await Category.create({ ...c, slug, sortOrder: i, isActive: true });
      console.log(`Created category: ${c.name}`);
    }
  }

  // 3. Default settings
  const existingSettings = await Settings.findOne({ key: 'global' });
  if (!existingSettings) {
    await Settings.create({
      key: 'global',
      storeName: 'Subham Stores',
      ownerName: '',
      whatsapp: '918667658273',
      phone: '918667658273',
      altPhone: '',
      email: 'subhamstores2026@gmail.com',
      instagram: '',
      address: '68, Vinayagar Kovil Street, Thalavaipettai, Bhavani - 638312, Erode (Dt), Tamil Nadu',
      gstin: '',
      shippingFee: 49,
      freeShippingAbove: 999,
      seoTitle: 'Subham Stores | Kids Dress, Frocks & Baby Wear',
      seoDescription: 'Shop adorable kids dresses, frocks, party wear and baby wear from Subham Stores, Thalavaipettai, Bhavani, Erode.'
    });
    console.log('Created default store settings.');
  }

  console.log('\nSeed complete! Admin login:');
  console.log(`  Email: ${email}`);
  console.log(`  Password: ${process.env.ADMIN_PASSWORD || 'ChangeMe123!'}`);
  console.log('  URL: /admin/login\n');

  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });