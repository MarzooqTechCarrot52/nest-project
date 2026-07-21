import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { BookFetch } from './inventory.fetch';
import { HttpModule } from '@nestjs/axios';

@Module({
    imports: [HttpModule],
    providers:[
        {
            provide: InventoryService,
            useClass: InventoryService,
        },
        BookFetch,
    ],
    controllers: [InventoryController],
})
export class InventoryModule {}
