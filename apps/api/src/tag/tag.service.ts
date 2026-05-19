import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TagService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.tag.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { cards: true } } },
    });
  }

  async create(name: string) {
    const slug = name.toLowerCase().replace(/\s+/g, '-');
    return this.prisma.tag.upsert({
      where: { slug },
      update: {},
      create: { name, slug },
    });
  }
}
