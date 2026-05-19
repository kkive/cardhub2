import * as dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(__dirname, '../../../.env') });

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@cardshub.local';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123456';
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  // 1. Seed admin user (idempotent)
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: 'admin', passwordHash },
    create: {
      email: adminEmail,
      username: 'admin',
      passwordHash,
      role: 'admin',
    },
  });
  console.log(`Admin user: ${admin.email} (${admin.id})`);

  // 2. Seed default tags (idempotent)
  const tagNames = [
    'fantasy', 'sci-fi', 'romance', 'horror', 'comedy',
    'anime', 'rpg', 'assistant', 'creative', 'education',
  ];

  for (const name of tagNames) {
    const slug = name.toLowerCase().replace(/\s+/g, '-');
    await prisma.tag.upsert({
      where: { slug },
      update: {},
      create: { name, slug },
    });
  }
  console.log(`Seeded ${tagNames.length} tags`);

  // 3. Seed example free card (idempotent by title + author)
  const exampleCardTitle = 'Example Character Card';
  const existingCard = await prisma.card.findFirst({
    where: { title: exampleCardTitle, authorId: admin.id },
  });

  if (!existingCard) {
    const fantasyTag = await prisma.tag.findUnique({ where: { slug: 'fantasy' } });

    const card = await prisma.card.create({
      data: {
        title: exampleCardTitle,
        description: 'A sample character card to demonstrate the platform. Free to download!',
        status: 'published',
        content: {
          cardType: 'character',
          data: {
            name: 'Aria',
            description: 'A wise and mysterious elven mage who has traveled the world for centuries. She speaks with a calm, measured tone and often shares cryptic wisdom.',
            firstMessage: '*The door to the ancient library creaks open. A tall elf with silver hair looks up from a massive tome.*\n\nAh, a visitor. It has been quite some time since anyone has found their way here. I am Aria. Please, sit — the tea is still warm.',
            exampleMessages: '<START>\n{{user}}: Who are you?\n{{char}}: *She closes the book gently.* I am Aria, keeper of this library. I have walked these lands for more years than most kingdoms have stood. And you, traveler — what brings you to my door?\n<START>\n{{user}}: Tell me about magic.\n{{char}}: *Her eyes gleam with ancient knowledge.* Magic is not a tool, young one. It is a conversation with the world. You do not command it — you ask, and it answers. The question is whether you are prepared for the reply.',
            personality: 'Wise, patient, mysterious, gentle, occasionally cryptic',
            scenario: 'An ancient library hidden in a forest clearing, filled with books from every era',
            tags: ['fantasy', 'rpg', 'creative'],
          },
        },
        visibility: 'public',
        price: 0,
        authorId: admin.id,
        tags: fantasyTag
          ? { create: [{ tagId: fantasyTag.id }] }
          : undefined,
      },
    });

    // Create initial version
    await prisma.cardVersion.create({
      data: { cardId: card.id, version: 1, content: card.content as any },
    });

    console.log(`Seeded example card: ${card.title} (${card.id})`);
  } else {
    console.log(`Example card already exists: ${existingCard.title}`);
  }

  // 4. Create Meilisearch index settings (best-effort)
  try {
    const { MeiliSearch } = require('meilisearch');
    const meili = new MeiliSearch({
      host: process.env.MEILI_HOST || 'http://localhost:7700',
      apiKey: process.env.MEILI_API_KEY || '',
    });

    const index = meili.index('cards');
    await index.updateSettings({
      searchableAttributes: ['title', 'description', 'tags'],
      filterableAttributes: ['visibility', 'price', 'cardType', 'status', 'tags'],
      sortableAttributes: ['createdAt', 'downloadCount', 'price'],
    });
    console.log('Meilisearch index settings configured');
  } catch (err: any) {
    console.log(`Meilisearch setup skipped: ${err.message}`);
  }

  console.log('Seed complete!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
