import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/** Interactive docs at /docs. Click "Authorize" and paste an access_token from POST /api/auth/login. */
export function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('IMS API')
    .setDescription(
      'Inventory Management (ISMO Biophotonics): Item Master → PR → PO → GRN.\n\n' +
        'Units: PR and stock use the stock unit; PO and GRN use the purchase unit.\n' +
        'Errors always look like { statusCode, error, message, details? }.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);
}
