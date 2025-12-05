import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { UtilService } from 'src/libs/utils/util.service';
@Module({
    providers:[InventoryService, UtilService],
    controllers: [InventoryController]
})
export class InventoryModule {}
