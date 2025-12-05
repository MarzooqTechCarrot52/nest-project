import { Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class ValidationService {
  createBody(body: any) {
    if (!body.title || !body.author || !body.price) {
      throw new BadRequestException('Missing title, author, or price in request body');
    }
    return body;
  }
}
