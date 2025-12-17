import { Module } from '@nestjs/common';
import { BookController } from './book.controller';
import { BookService } from './book.service';
import { ValidationService } from '../libs/helper/validation.service';
import {UtilService} from '../libs/utils/util.service';
import { HttpModule } from '@nestjs/axios';

const mockBookService = {
    findAll() {
        return [{
            title : "Wings and Fire",
            author : "ABC",
            price : 123
        }]
    }
}

@Module({
    imports:[HttpModule],
    controllers:[BookController],
    providers:[

        // BookService,
        
        // CLASS PROVIDER
        // {
        //     provide: BookService,
        //     useClass: BookService
        // }
        // VALUE PROVIDER
        {
            provide: BookService,
            useValue: mockBookService
        }
        ,ValidationService,UtilService],
})
export class BookModule {}
