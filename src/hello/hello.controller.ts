import { Controller, Get, Query } from '@nestjs/common';

@Controller('hello')
export class HelloController {
    @Get()
    name(@Query('user') user:string) {
        return `Hello ${user}`;
    }
}
