import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllExceptionsFilter } from './presentation/common/all-exceptions.filter';

export function setupApp(app: INestApplication) {
  app.setGlobalPrefix('api');
  // Browsers may call the API only from these origins (comma-separated, e.g.
  // "http://localhost:5173,https://ims.example.com"). Unset: no cross-origin calls.
  // Postman and the Swagger page (same origin) are not affected.
  const origins = corsOrigins(app.get(ConfigService).get<string>('CORS_ORIGINS'));
  if (origins.length > 0) app.enableCors({ origin: origins });
  app.useGlobalFilters(new AllExceptionsFilter());
}

function corsOrigins(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}
