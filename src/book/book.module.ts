import { Module } from '@nestjs/common';
import { BookController } from './book.controller';
import { BookService } from './book.service';
import { ValidationService } from '../libs/helper/validation.service';
import {UtilService} from '../libs/utils/util.service';

@Module({
    controllers:[BookController],
    providers:[BookService,ValidationService,UtilService]
})
export class BookModule {}
