export class CreateCardDto {
  title: string;
  description?: string;
  content: Record<string, unknown>;
  cardType: 'character' | 'worldbook' | 'preset';
  visibility?: 'public' | 'unlisted' | 'private';
  price?: number;
  tags?: string[];
}
