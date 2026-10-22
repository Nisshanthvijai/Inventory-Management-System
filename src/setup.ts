import { INestApplication } from '@nestjs/common';
import { AllExceptionsFilter } from './presentation/common/all-exceptions.filter';

export function setupApp(app: INestApplication) {
  app.setGlobalPrefix('api');
  app.enableCors();
  app.useGlobalFilters(new AllExceptionsFilter());
}
