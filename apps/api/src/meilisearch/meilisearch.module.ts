import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MeiliSearch } from 'meilisearch';

export const MEILISEARCH_CLIENT = 'MEILISEARCH_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: MEILISEARCH_CLIENT,
      useFactory: (config: ConfigService) => {
        const host = config.get<string>('MEILI_HOST', 'http://localhost:7700');
        const apiKey = config.get<string>('MEILI_API_KEY', '');
        return new MeiliSearch({ host, apiKey });
      },
      inject: [ConfigService],
    },
  ],
  exports: [MEILISEARCH_CLIENT],
})
export class MeilisearchModule {}
