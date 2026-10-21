import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { configureApp } from './common/configure-app';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { createOpenApiDocument } from './swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  configureApp(app);

  const favicon = readFileSync(
    join(__dirname, 'assets', 'brand', 'favicon.svg'),
  ).toString('base64');
  SwaggerModule.setup('docs', app, createOpenApiDocument(app), {
    customSiteTitle: 'teamorbit API docs',
    customfavIcon: `data:image/svg+xml;base64,${favicon}`,
  });

  const port = app.get(ConfigService).getOrThrow<number>('PORT');
  await app.listen(port);
}
void bootstrap();
