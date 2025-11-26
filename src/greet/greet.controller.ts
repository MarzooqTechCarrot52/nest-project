import { Controller, Get, Param } from '@nestjs/common';

@Controller("greet")
export class GreetController {
    @Get('/:name')
    HiFunction(@Param('name')user : string){
        return `Hi ${user}`;
    }
}
