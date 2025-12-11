import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { UtilService } from 'src/libs/utils/util.service';
import { BookFetch } from './inventory.fetch';
import {HttpModule} from '@nestjs/axios';

@Module({
    imports: [HttpModule],
    providers:[InventoryService, UtilService,BookFetch],
    controllers: [InventoryController]
})
export class InventoryModule {}
