import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateBookDto , UpdateBookDto } from './book.dto';
import type { Book } from './book.interface';

@Injectable()
export class BookService {
    private books :Book[]=[]
    private counter = 1;

    create(createbook:CreateBookDto):Book{
        const newBook: Book ={
            id: this.counter++,
            ...createbook,
        };
        this.books.push(newBook);
        return newBook
    }

    findAll() : Book[] {
        return this.books
    }
    
    findOne(id:number):Book{
        const book = this.books.find(book => book.id ===id)
        if(!book){
            throw new NotFoundException(`Book Not Found with this id ${id}`)
        }
        return book
    }

    update(id:number, update:UpdateBookDto) {
        const book = this.findOne(id)
        const newbook = {...book,...update}
        const index = this.books.findIndex(book => book.id===id)
        this.books[index]=newbook
        return newbook
    }

    remove(id:number):Book{
        const index = this.books.findIndex(book => book.id ===id)
        if(index===-1){
            throw new NotFoundException(`Book Not Found with this id ${id}`)
        }
        const removeditem = this.books.splice(index,1)[0]
        return removeditem
    }
}