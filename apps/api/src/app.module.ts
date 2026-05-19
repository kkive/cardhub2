import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { MeilisearchModule } from './meilisearch/meilisearch.module';
import { HealthModule } from './health/health.module';
import { CardModule } from './card/card.module';
import { TagModule } from './tag/tag.module';
import { FileModule } from './file/file.module';
import { AdminModule } from './admin/admin.module';
import { PasskeyModule } from './passkey/passkey.module';
import { OrderModule } from './order/order.module';
import { PaymentModule } from './payment/payment.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { SystemConfigModule } from './config/config.module';
import { UserModule } from './user/user.module';
import { AuditModule } from './audit/audit.module';
import { CollectionModule } from './collection/collection.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    MeilisearchModule,
    HealthModule,
    CardModule,
    TagModule,
    FileModule,
    AdminModule,
    PasskeyModule,
    OrderModule,
    PaymentModule,
    AuthModule,
    SystemConfigModule,
    UserModule,
    AuditModule,
    CollectionModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
