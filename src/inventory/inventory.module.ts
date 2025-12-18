import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { UtilService } from '../libs/utils/util.service';
import { BookFetch } from './inventory.fetch';
import {HttpModule} from '@nestjs/axios';

@Module({
    imports: [HttpModule],
    providers:[
        {
        provide:InventoryService, //TOKEN
        useClass:InventoryService //CLASS      TOKEN->CLASS
        },
        UtilService,
        BookFetch,
    ],
    controllers: [InventoryController]
})
export class InventoryModule {}
