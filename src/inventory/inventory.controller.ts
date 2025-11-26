import { Controller, Get, Post, Put, Param, Body, Query } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import type { Item } from './inventory.service';

@Controller('inventory')
export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  @Post()
  createInventory(@Body() item: Item){
    try {  
        const inventoryData = this.inventoryService.createItem(item);
        return {
            message :'Data Stored Sucessfully',
            data :inventoryData
        }
    }
    catch (error) {
        return { message : error.message }
    }
  }
  @Get()
  getInventory(@Query('category') category?:string,@Query('isInStock') isInStock?:string) {
    const item = this.inventoryService.getItem(category ,isInStock );
    return { 
        message:'Data Fetched Sucessfully',
        data: item
    }
  }

  @Put(':id')
  updateInventory(@Param('id') id: string,@Body() Body: Item) {
    try {
      const updateInventoryData = this.inventoryService.updateItem(id, Body);
      return {
        message:'Data updated successfully',
        data: updateInventoryData
        }   
    } catch (error) {
      return { message : error.message};
    }
  }
}
