import { Controller, Get, Post, Put, Param, Body, Query } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { UtilService } from '../libs/utils/util.service';
import type{ Item } from './inventory.service';

@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly util : UtilService,
  ) {}
  
  @Post()
  createInventory(@Body() item: Item){
    try {  
        const inventoryData = this.inventoryService.createItem(item);
        return this.util.createResponse({
          status: inventoryData ? 'SUCCESS' : 'BAD_REQUEST',
          cat: 'INVENTORY',
          data: inventoryData,
        })
    }
    catch (error) {
        return { message : error.message }
    }
  }
  
  @Get()
  getInventory(@Query('category') category?:string,@Query('isInStock') isInStock?:string) {
    const inventoryData = this.inventoryService.getItem(category ,isInStock );
    return this.util.createResponse({ 
      status: inventoryData ? 'SUCCESS' : 'BAD_REQUEST',
      cat: 'INVENTORY',
      data: inventoryData,
    })
  }

  @Put(':id')
  updateInventory(@Param('id') id: string,@Body() Body: Item) {
    try {
      const InventoryData = this.inventoryService.updateItem(id, Body);
      return this.util.createResponse({
        status: InventoryData ? 'SUCCESS' : 'BAD_REQUEST',
        cat: 'INVENTORY',
        data: InventoryData,
      })
    }catch (error) {
      return { message : error.message};
    }
  }
}
