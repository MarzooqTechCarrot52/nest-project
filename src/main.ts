import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ||3000);
  console.log("Auth Token:", process.env.AUTH_TOKEN);
  console.log("PORT:", process.env.PORT);
}
bootstrap();
