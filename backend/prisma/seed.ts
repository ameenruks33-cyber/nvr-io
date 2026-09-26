import { PrismaClient, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { createCipheriv, randomBytes } from 'crypto';

const prisma = new PrismaClient();

function encrypt(plaintext: string, keyB64: string) {
  const key = Buffer.from(keyB64, 'base64');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
}

async function main() {
  const encryptionKey =
    process.env.FIELD_ENCRYPTION_KEY ||
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
  const adminEmail =
    process.env.SEED_ADMIN_EMAIL || 'admin@jithubuy.local';
  const adminPassword =
    process.env.SEED_ADMIN_PASSWORD || 'ChangeMeAdmin123!';

  const passwordHash = await argon2.hash(adminPassword, {
    type: argon2.argon2id,
  });

  const admin = await prisma.user.upsert({
    where: { email: adminEmail.toLowerCase() },
    update: {},
    create: {
      name: process.env.SEED_ADMIN_NAME || 'Super Admin',
      email: adminEmail.toLowerCase(),
      phone: '+971500000001',
      passwordHash,
      role: UserRole.SUPER_ADMIN,
    },
  });

  const collectorHash = await argon2.hash('Collector123!', {
    type: argon2.argon2id,
  });

  const collector = await prisma.user.upsert({
    where: { email: 'collector@jithubuy.local' },
    update: {},
    create: {
      name: 'Demo Collector',
      email: 'collector@jithubuy.local',
      phone: '+971500000002',
      passwordHash: collectorHash,
      role: UserRole.COLLECTOR,
    },
  });

  const existing = await prisma.customer.findUnique({
    where: { customerCode: 'JB-CUS-000001' },
  });

  if (!existing) {
    const customer = await prisma.customer.create({
      data: {
        customerCode: 'JB-CUS-000001',
        name: 'Ahmed Demo',
        phone: '+971501234567',
        address: 'Dubai, UAE',
        passportEncrypted: encrypt('P1234567', encryptionKey),
        aadhaarEncrypted: encrypt('123456789012', encryptionKey),
        latitude: 25.2048,
        longitude: 55.2708,
        locationAccuracy: 12.5,
        consentVersion: 'v1',
        registeredById: collector.id,
      },
    });

    const loan = await prisma.loan.create({
      data: {
        customerId: customer.id,
        principalAmount: 1800,
        dailyPayment: 100,
        totalPayable: 1800,
        amountCollected: 700,
        remainingAmount: 1100,
        status: 'ACTIVE',
      },
    });

    for (let i = 1; i <= 7; i++) {
      await prisma.repayment.create({
        data: {
          loanId: loan.id,
          amount: 100,
          collectedById: collector.id,
          receiptNumber: `JB-RCP-0000000${i}`,
          notes: `Seed repayment day ${i}`,
        },
      });
    }

    const completedCustomer = await prisma.customer.create({
      data: {
        customerCode: 'JB-CUS-000002',
        name: 'Mohammed Demo',
        phone: '+971509876543',
        address: 'Abu Dhabi, UAE',
        passportEncrypted: encrypt('P7654321', encryptionKey),
        aadhaarEncrypted: encrypt('987654321098', encryptionKey),
        latitude: 24.4539,
        longitude: 54.3773,
        locationAccuracy: 10,
        consentVersion: 'v1',
        registeredById: admin.id,
      },
    });

    await prisma.loan.create({
      data: {
        customerId: completedCustomer.id,
        principalAmount: 1800,
        dailyPayment: 100,
        totalPayable: 1800,
        amountCollected: 1800,
        remainingAmount: 0,
        status: 'COMPLETED',
        completedAt: new Date(),
        closedAt: new Date(),
      },
    });
  }

  console.log('Seed complete');
  console.log(`Admin: ${adminEmail}`);
  console.log('Collector: collector@jithubuy.local / Collector123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
