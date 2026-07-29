const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const products = [
  { name: "Oakridge Sofa", description: "3-seater fabric sofa in warm grey.", price: 799, emoji: "🛋️", category: "Living Room" },
  { name: "Willow Armchair", description: "Compact accent armchair.", price: 349, emoji: "🪑", category: "Living Room" },
  { name: "Birch Coffee Table", description: "Solid oak coffee table.", price: 229, emoji: "🟫", category: "Living Room" },
  { name: "Halo Floor Lamp", description: "Adjustable arc floor lamp.", price: 99, emoji: "💡", category: "Living Room" },
  { name: "Meadow Rug", description: "Hand-woven wool area rug.", price: 149, emoji: "🟩", category: "Living Room" },
  { name: "Harlow Dining Table", description: "Seats up to 6, oak veneer.", price: 549, emoji: "🍽️", category: "Dining" },
  { name: "Harlow Dining Chair", description: "Upholstered dining chair.", price: 89, emoji: "🪑", category: "Dining" },
  { name: "Cascade Bed Frame", description: "Queen-size upholstered bed frame.", price: 649, emoji: "🛏️", category: "Bedroom" },
  { name: "Elmwood Wardrobe", description: "3-door wardrobe with mirror.", price: 459, emoji: "🚪", category: "Bedroom" },
  { name: "Sorrel Bookshelf", description: "5-shelf bookcase, walnut finish.", price: 189, emoji: "📚", category: "Study" },
  { name: "Nova Desk", description: "Compact study desk.", price: 259, emoji: "🖥️", category: "Study" },
];

async function main() {
  for (const product of products) {
    await prisma.product.upsert({
      where: { name: product.name },
      update: {},
      create: product,
    });
  }

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

  console.log(`Seeded ${products.length} products and a demo account (${demoEmail} / password123).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
