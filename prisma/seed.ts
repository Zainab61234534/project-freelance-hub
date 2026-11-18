import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import bcrypt from 'bcryptjs';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  // 1. حساب المدير
  const email = 'admin@freelancehub.com';
  const password = process.env.ADMIN_PASSWORD;

  if (!password) {
    throw new Error('ADMIN_PASSWORD is not defined in .env');
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      name: 'System Admin',
      password: hashedPassword,
      role: 'ADMIN',
      isBanned: false,
    },
    create: {
      name: 'System Admin',
      email,
      password: hashedPassword,
      role: 'ADMIN',
      isBanned: false,
    },
  });

  console.log('Admin account created or updated:', admin.email);

  // 2. محفظة المنصة (لا تُنشأ إلا إن لم تكن موجودة)
  const platformWallet = await prisma.wallet.findFirst({
    where: { isPlatform: true },
  });

  if (platformWallet) {
    console.log('Platform wallet already exists');
  } else {
    await prisma.wallet.create({
      data: { isPlatform: true },
    });
    console.log('Platform wallet created successfully');
  }
}

main()
  .catch((error) => {
    console.error('Seed error:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });