import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true, // needed for Stripe webhook signature verification
  });
  app.enableCors();
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Cards hub API running on :${port}`);
}
bootstrap();
