/**
 * Platform-agnostic card schema for Cards hub.
 */

export interface CardMeta {
  id: string;
  title: string;
  description?: string;
  tags: string[];
  status: 'draft' | 'published';
  visibility: 'public' | 'unlisted' | 'private';
  price: number; // 0 = free, >0 = paid (cents)
  authorId: string;
  categoryId?: string;
  downloadCount: number;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface CardContent {
  /** The card payload — structure depends on cardType */
  data: Record<string, unknown>;
  /** Card type discriminator */
  cardType: string;
}

export interface CardFile {
  id: string;
  cardId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  visibility: 'public' | 'paid';
  createdAt: string;
}

export interface Card extends CardMeta {
  content: CardContent;
  files: CardFile[];
  category?: { id: string; name: string; slug: string } | null;
}

export interface CardListItem {
  id: string;
  title: string;
  description?: string;
  tags: string[];
  visibility: string;
  price: number;
  downloadCount: number;
  authorId: string;
  categoryId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CardSearchQuery {
  q?: string;
  categorySlug?: string;
  tags?: string[];
  visibility?: string;
  priceMin?: number;
  priceMax?: number;
  sort?: 'relevance' | 'newest' | 'popular' | 'price_asc' | 'price_desc';
  page?: number;
  limit?: number;
}

export interface CardSearchResult {
  items: CardListItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// --- Platform card JSON export format ---

export interface PlatformCardExport {
  version: '1.0';
  format: 'cards-hub-platform';
  exportedAt: string;
  card: {
    title: string;
    description?: string;
    cardType: string;
    data: Record<string, unknown>;
    tags: string[];
    visibility: string;
    price: number;
  };
  files: Array<{
    filename: string;
    mimeType: string;
    sizeBytes: number;
    visibility: string;
  }>;
}

/**
 * Build a platform JSON export from card data.
 */
export function buildPlatformExport(card: {
  title: string;
  description?: string;
  content: CardContent;
  tags: string[];
  visibility: string;
  price: number;
  files: Array<{ filename: string; mimeType: string; sizeBytes: number; visibility: string }>;
}): PlatformCardExport {
  return {
    version: '1.0',
    format: 'cards-hub-platform',
    exportedAt: new Date().toISOString(),
    card: {
      title: card.title,
      description: card.description,
      cardType: card.content.cardType,
      data: card.content.data,
      tags: card.tags,
      visibility: card.visibility,
      price: card.price,
    },
    files: card.files.map(f => ({
      filename: f.filename,
      mimeType: f.mimeType,
      sizeBytes: f.sizeBytes,
      visibility: f.visibility,
    })),
  };
}
