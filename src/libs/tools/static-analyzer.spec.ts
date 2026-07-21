import * as ts from 'typescript';
import { buildOpenApi, collectControllers, collectSchemas, collectServices } from './static-analyzer';

describe('static analyzer response inference', () => {
  it('uses a string schema and example for the root hello route', () => {
    const source = `
      import { Controller, Get } from '@nestjs/common';
      import { Injectable } from '@nestjs/common';

      @Injectable()
      class AppService {
        getHello(): string {
          return 'Hello Server is Running!';
        }
      }

      @Controller()
      class AppController {
        constructor(private readonly appService: AppService) {}

        @Get()
        getHello(): string {
          return this.appService.getHello();
        }
      }
    `;

    const file = ts.createSourceFile('app.ts', source, ts.ScriptTarget.Latest, true);
    const schemas = collectSchemas(file);
    const services = collectServices(file);
    const controllers = collectControllers(file, services, schemas);
    const openApi = buildOpenApi(controllers, schemas);
    const rootResponse = openApi.paths['/'].get.responses['200'].content['application/json'];

    expect(rootResponse.schema).toEqual({ type: 'string' });
    expect(rootResponse.example).toBe('Hello Server is Running!');
    expect(openApi.paths['/'].get.responses['503']).toBeDefined();
  });
});
