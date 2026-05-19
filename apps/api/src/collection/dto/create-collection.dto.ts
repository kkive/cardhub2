export class CreateCollectionDto {
  title: string;
  description?: string;
  summary?: string;
  coverUrl?: string;
  price?: number;
  characterCardId: string;
  worldbookCardId: string;
  presetCardId: string;
}

export class UpdateCollectionDto {
  title?: string;
  description?: string;
  summary?: string;
  coverUrl?: string;
  price?: number;
  characterCardId?: string;
  worldbookCardId?: string;
  presetCardId?: string;
}

export class SearchCollectionDto {
  q?: string;
  priceMin?: number;
  priceMax?: number;
  sort?: 'newest' | 'popular' | 'price_asc' | 'price_desc';
  page?: number;
  limit?: number;
}
