import { Controller, Get, Post, Put, Param, Body, Query } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { UtilService } from '../libs/utils/util.service';
// import { BookFetch } from './inventory.fetch';
import type{ Item } from './inventory.service';

@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly util : UtilService,
    // private readonly fetch : BookFetch,
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
  // @Get()
  // async getAll() {
  //   const response = await this.fetch.fetchInventory();
  //   console.log(response)
  //   return this.util.createResponse({
  //     status: response ? 'SUCCESS' : 'BAD_REQUEST',
  //     cat: 'BOOK',
  //     data: response
  //   });
  // }
  
  @Get()
  getInventory(@Query('category') category?:string,@Query('isInStock') isInStock?:string) {
    const inventoryData = this.inventoryService.getItem(category ,isInStock );
    return this.util.createResponse({ 
      status: inventoryData ? 'SUCCESS' : 'BAD_REQUEST',
      cat: 'INVENTORY',
      data: inventoryData,
    })
  }

  @Get(":id")
  getOneInventory(@Param('id') id:string){
    const inventoryData= this.inventoryService.getOne(id);
    return this.util.createResponse({
      status: inventoryData ? 'SUCESSS' : 'BAD REQUEST',
      cat : 'INVENTORY',
      data: inventoryData
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
