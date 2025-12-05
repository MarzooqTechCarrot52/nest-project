import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class BookFetch {
  constructor(private readonly http: HttpService) {}

  async fetchInventory() {
    const response = await firstValueFrom(
      this.http.get('http://localhost:3000/inventory')
    );

    return response.data; 
}
}
