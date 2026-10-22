import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupApp } from './setup';
import { setupSwagger } from './swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  setupApp(app);
  setupSwagger(app); // docs only in the real server; tests call setupApp alone
  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
