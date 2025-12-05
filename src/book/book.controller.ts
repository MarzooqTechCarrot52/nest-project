import {Post, Body, Controller, Get, Param, Put, Delete} from '@nestjs/common';
import {BookService} from './book.service';
import {ValidationService} from '../libs/helper/validation.service';
import {UtilService} from '../libs/utils/util.service';
import {CreateBookDto,UpdateBookDto} from './book.dto';
import { BookFetch } from './book.fetch';

@Controller('book')
export class BookController{
  constructor(
    private readonly service:BookService,
    private readonly validation:ValidationService,
    private readonly util:UtilService,
    private readonly fetch:BookFetch
) {}
  @Post()
  create(@Body() body: CreateBookDto) {
    const request = this.validation.createBody(body);
    const response = this.service.create(request);

    return this.util.createResponse({
      status: response ? 'SUCCESS' : 'BAD_REQUEST',
      cat: 'BOOK',
      data: response
    });
  }

  @Get()
  async getAll() {
    const response = await this.fetch.fetchInventory();

    return this.util.createResponse({
      status: response ? 'SUCCESS' : 'BAD_REQUEST',
      cat: 'BOOK',
      data: response
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    const response = this.service.findOne(+id);

    return this.util.createResponse({
      status: response ? 'SUCCESS' : 'BAD_REQUEST',
      cat: 'BOOK', 
      data: response
    });
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: UpdateBookDto) {
    const response = this.service.update(+id, body);

    return this.util.createResponse({
      status: response ? 'SUCCESS' : 'BAD_REQUEST',
      cat: 'BOOK',
      data: response
    });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    const response = this.service.remove(+id);

    return this.util.createResponse({
      status: response ? 'SUCCESS' : 'BAD_REQUEST',
      cat: 'BOOK',
      data: response
    });
  }
}
