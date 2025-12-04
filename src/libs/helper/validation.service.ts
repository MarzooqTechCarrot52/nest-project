import { Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class ValidationService {
  createBody(body: any) {
    if (!body.title || !body.author || !body.year) {
      throw new BadRequestException('Missing title, author, or year');
    }
    return body;
  }
}
