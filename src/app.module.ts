import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GreetController } from './greet/greet.controller';
import { HelloController } from './hello/hello.controller';
import { InventoryModule } from './inventory/inventory.module';
import { BookModule } from './book/book.module';

@Module({
  imports: [InventoryModule, BookModule],
  controllers: [AppController, GreetController, HelloController],
  providers: [AppService],
})
export class AppModule {}
