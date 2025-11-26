import { Injectable } from '@nestjs/common';
import RunTimeDatabase from 'src/libs/helper/runTImeDatabase';
import { v4 as uuid } from 'uuid';

export interface Item {
  id?: string;
  name: string;
  category: string;
  quantity: number;
  price: number;
  isInStock?: boolean
}

@Injectable()
export class InventoryService {
  private db = RunTimeDatabase.getInstance();

  public createItem (item:Item){
    const id = uuid();
    const newItem = {
      ...item , 
      id,
      isInStock : item.quantity>0
    }
    this.db.set(id,newItem)
    return newItem
}

  public getItem(category?:string,isInStock?:string){
    let item = this.db.values()
    if (category){
      item = item.filter(item => item.category === category)
    }
    if(isInStock){
      console.log(isInStock)
      const stock = isInStock ==='true'
      item = item.filter(item=>item.isInStock===stock)
    }
    return item

  }

  public updateItem(id: string, Body: Item){
    const items = this.db.values()

    const index = items.findIndex((item) => item.id === id);

    if (index === -1) {
      throw new Error('Item not found');
    }

    const exisitingItem = items[index];
    const updatedItem = { 
      ...exisitingItem, 
      ...Body, 
      id: exisitingItem.id
    };

    return this.db.set(id, updatedItem);
  }
}
