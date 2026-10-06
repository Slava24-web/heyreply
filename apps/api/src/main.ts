import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { config } from './config';
import { originGuard } from './common/origin.middleware';

async function bootstrap() {
  const cfg = config();
  // Body parsers are registered by hand: the e-mail webhook needs a larger limit than everything else
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  // req.ip = client address as reported by our own proxy hops only (rate limiting depends on it)
  app.set('trust proxy', cfg.TRUST_PROXY_HOPS);
  app.disable('x-powered-by');
  app.use('/api/v1/inbound/email', json({ limit: '2.5mb' }));
  app.use(json({ limit: '100kb' }));
  app.use(urlencoded({ extended: false, limit: '100kb' }));
  app.setGlobalPrefix('api/v1', { exclude: ['api/health'] });
  app.use(helmet());
  app.use(cookieParser());
  app.use(originGuard(cfg.WEB_ORIGIN));
  app.enableCors({ origin: cfg.WEB_ORIGIN, credentials: true });
  app.enableShutdownHooks();

  if (cfg.swagger) {
    const doc = new DocumentBuilder().setTitle('heyreply API').setDescription('Job application tracker').setVersion('1.0').addCookieAuth('access_token').build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, doc));
  }

  await app.listen(cfg.PORT);
  console.log(`API listening on http://localhost:${cfg.PORT}${cfg.swagger ? ' (docs: /api/docs)' : ''}`);
}
bootstrap();
