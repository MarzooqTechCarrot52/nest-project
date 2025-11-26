import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GreetController } from './greet/greet.controller';
import { HelloController } from './hello/hello.controller';
import { InventoryController } from './inventory/inventory.controller';
import { InventoryService } from './inventory/inventory.service';
import { InventoryModule } from './inventory/inventory.module';

@Module({
  imports: [InventoryModule],
  controllers: [AppController, GreetController, HelloController, InventoryController],
  providers: [AppService, InventoryService],
})
export class AppModule {}
