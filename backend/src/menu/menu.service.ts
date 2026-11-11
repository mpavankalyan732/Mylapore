import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MenuService {
  constructor(private readonly prisma: PrismaService) {}

  /** Public menu grouped by category. Prices are in paise. */
  async getMenu() {
    return this.prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async getItem(slug: string) {
    const item = await this.prisma.menuItem.findUnique({ where: { slug }, include: { category: { select: { slug: true, names: true } } } });
    if (!item) throw new NotFoundException('Menu item not found');
    return item;
  }

  async update(id: string, data: { isAvailable?: boolean; pricePaise?: number }) {
    return this.prisma.menuItem.update({ where: { id }, data });
  }
}
