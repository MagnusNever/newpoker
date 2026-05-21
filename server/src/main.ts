import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: '*',
    methods: '*',
  });
  await app.listen(process.env.PORT || 3000);
  console.log(`Game server running on http://localhost:${process.env.PORT || 3000}`);
}
bootstrap();
