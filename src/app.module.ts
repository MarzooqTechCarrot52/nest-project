import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { InventoryModule } from './inventory/inventory.module';
import { BookModule } from './book/book.module';
import { AddHeaderMiddleware } from './add.header';


@Module({
  imports: [InventoryModule, BookModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule{
  configure(consumer: MiddlewareConsumer) {
    consumer
    .apply(AddHeaderMiddleware)
    .forRoutes({path:'book',method:RequestMethod.GET})
  }
}
