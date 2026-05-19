export class SearchCardDto {
  q?: string;
  cardType?: 'character' | 'worldbook' | 'preset';
  tags?: string;
  visibility?: string;
  priceMin?: number;
  priceMax?: number;
  sort?: 'relevance' | 'newest' | 'popular' | 'price_asc' | 'price_desc';
  page?: number;
  limit?: number;
}
