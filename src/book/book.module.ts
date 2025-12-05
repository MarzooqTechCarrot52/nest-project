import { Module } from '@nestjs/common';
import { BookController } from './book.controller';
import { BookService } from './book.service';
import { ValidationService } from '../libs/helper/validation.service';
import {UtilService} from '../libs/utils/util.service';
import {HttpModule} from '@nestjs/axios';
import { BookFetch } from './book.fetch';

@Module({
    imports:[HttpModule],
    controllers:[BookController],
    providers:[BookService,ValidationService,UtilService, BookFetch],
})
export class BookModule {}
