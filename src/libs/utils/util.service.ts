import { Injectable } from "@nestjs/common";

@Injectable()
export class UtilService{
    createResponse({ status, cat, data }) {
    return {
      status,
      category: cat,
      data,
    }
}
}