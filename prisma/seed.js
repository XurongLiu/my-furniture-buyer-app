const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

// Product catalogue is no longer seeded here — it's loaded from the real
// catalog source via `npm run import:catalog` (scripts/import-catalog.mjs).
// This script only sets up a demo account to log in with.
async function main() {
  const demoEmail = "demo@example.com";
  const existing = await prisma.user.findUnique({ where: { email: demoEmail } });
  if (!existing) {
    await prisma.user.create({
      data: {
        name: "Demo Buyer",
        email: demoEmail,
        passwordHash: await bcrypt.hash("password123", 10),
        budget: 1500,
      },
    });
  }

  console.log(`Seeded a demo account (${demoEmail} / password123).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
