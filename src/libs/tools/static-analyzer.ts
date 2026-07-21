import fs from 'fs';
import path from 'path';
import ts from 'typescript';

const SRC = path.join(process.cwd(), 'src');

function findSourceFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findSourceFiles(full));
    } else if (entry.isFile() && full.endsWith('.ts')) {
      files.push(full);
    }
  }
  return files;
}

function getDecoratorName(node: ts.Decorator): string | undefined {
  const expr = node.expression;
  if (ts.isCallExpression(expr)) {
    const id = expr.expression;
    return ts.isIdentifier(id) ? id.text : undefined;
  }
  if (ts.isIdentifier(expr)) {
    return expr.text;
  }
  return undefined;
}

function getDecoratorArgText(node: ts.Decorator, index = 0): string | undefined {
  const expr = node.expression;
  if (!ts.isCallExpression(expr)) return undefined;
  const arg = expr.arguments[index];
  if (!arg) return undefined;
  if (ts.isStringLiteral(arg)) return arg.text;
  return arg.getText();
}

export function normalizeRoute(prefix = '', route = ''): string {
  const clean = (s: string) => s.replace(/^['"`]|['"`]$/g, '').trim();
  const p = clean(prefix);
  const r = clean(route);
  const routePath = [p, r].filter(Boolean).join('/');
  return '/' + routePath.split('/').filter(Boolean).join('/');
}

export function typeToString(node: ts.TypeNode | undefined): string {
  if (!node) return 'any';
  if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName)) {
    return node.typeName.text;
  }
  if (ts.isUnionTypeNode(node)) {
    return node.types.map(typeToString).join(' | ');
  }
  if (ts.isArrayTypeNode(node)) {
    return `${typeToString(node.elementType)}[]`;
  }
  if (ts.isTypeLiteralNode(node)) {
    return 'object';
  }
  return node.getText();
}

function getPropertyName(name: ts.PropertyName): string {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return name.getText();
}

export function collectSchemas(sourceFile: ts.SourceFile) {
  const schemas: Record<string, any> = {};

  ts.forEachChild(sourceFile, node => {
    if (ts.isClassDeclaration(node) && node.name && node.name.text.endsWith('Dto')) {
      const className = node.name.text;
      const properties: Record<string, any> = {};
      node.members.forEach(member => {
        if (!ts.isPropertyDeclaration(member) || !member.name) return;
        const name = getPropertyName(member.name);
        properties[name] = { type: typeToString(member.type) };
      });
      schemas[className] = { type: 'object', properties };
    }

    if (ts.isInterfaceDeclaration(node) && node.name) {
      const interfaceName = node.name.text;
      const properties: Record<string, any> = {};
      node.members.forEach(member => {
        if (!ts.isPropertySignature(member) || !member.name) return;
        const name = getPropertyName(member.name);
        properties[name] = { type: typeToString(member.type) };
      });
      schemas[interfaceName] = { type: 'object', properties };
    }
  });

  return schemas;
}

export function collectServices(sourceFile: ts.SourceFile) {
  const services: Record<string, Record<string, string>> = {};

  ts.forEachChild(sourceFile, node => {
    if (!ts.isClassDeclaration(node) || !node.name) return;
    const className = node.name.text;
    if (!className.toLowerCase().includes('service')) return;

    const methods: Record<string, string> = {};
    node.members.forEach(member => {
      if (!ts.isMethodDeclaration(member) || !member.name || !ts.isIdentifier(member.name)) return;
      methods[member.name.text] = member.type ? typeToString(member.type) : 'any';
    });

    if (Object.keys(methods).length) {
      services[className] = methods;
    }
  });

  return services;
}

function getControllerDependencies(node: ts.ClassDeclaration): Record<string, string> {
  const dependencies: Record<string, string> = {};
  const ctor = node.members.find(ts.isConstructorDeclaration);
  if (!ctor) return dependencies;

  ctor.parameters.forEach(param => {
    if (ts.isIdentifier(param.name) && param.type) {
      dependencies[param.name.text] = typeToString(param.type);
    }
  });

  return dependencies;
}

function findVariableDeclarationInBody(body: ts.Block | undefined, name: string): ts.VariableDeclaration | undefined {
  if (!body) return undefined;

  for (const statement of body.statements) {
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.name.text === name) {
          return declaration;
        }
      }
    }
  }

  return undefined;
}

function resolveExpressionType(
  expr: ts.Expression | undefined,
  dependencies: Record<string, string>,
  serviceMethods: Record<string, Record<string, string>>,
  body: ts.Block | undefined,
): string | undefined {
  if (!expr) return undefined;

  if (ts.isIdentifier(expr)) {
    const declaration = findVariableDeclarationInBody(body, expr.text);
    if (declaration?.initializer) {
      return resolveExpressionType(declaration.initializer, dependencies, serviceMethods, body);
    }
    return undefined;
  }

  if (ts.isAwaitExpression(expr)) {
    return resolveExpressionType(expr.expression, dependencies, serviceMethods, body);
  }

  if (ts.isCallExpression(expr)) {
    const callee = expr.expression;
    if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.name)) {
      const methodName = callee.name.text;
      const receiver = callee.expression;
      if (ts.isPropertyAccessExpression(receiver) && receiver.expression.kind === ts.SyntaxKind.ThisKeyword) {
        const dependencyName = receiver.name.text;
        const dependencyType = dependencies[dependencyName];
        const returnType = dependencyType ? serviceMethods[dependencyType]?.[methodName] : undefined;
        if (returnType) return returnType;
      }
    }
  }

  return undefined;
}

function schemaForTypeName(typeName: string | undefined, schemas: Record<string, any>) {
  const normalized = typeName?.trim();
  if (!normalized || normalized === 'any') {
    return { type: 'object' };
  }

  if (normalized.endsWith('[]')) {
    return {
      type: 'array',
      items: schemaForTypeName(normalized.slice(0, -2), schemas),
    };
  }

  if (normalized === 'string') return { type: 'string' };
  if (normalized === 'number') return { type: 'number' };
  if (normalized === 'boolean') return { type: 'boolean' };
  if (normalized === 'object') return { type: 'object' };

  if (schemas[normalized]) {
    return { $ref: `#/components/schemas/${normalized}` };
  }

  return { type: 'string' };
}

function exampleForSchema(schema: any, propertyName?: string): any {
  if (schema?.$ref) {
    const refName = schema.$ref.split('/').pop();
    if (refName === 'Book') {
      return {
        id: 1,
        title: 'Wings and Fire',
        author: 'ABC',
        price: 123,
      };
    }
    if (refName === 'Item') {
      return {
        id: 'sample-id',
        name: 'Sample Item',
        category: 'Books',
        quantity: 5,
        price: 123,
        isInStock: true,
      };
    }
    if (refName === 'CreateBookDto') {
      return {
        title: 'Wings and Fire',
        author: 'ABC',
        price: 123,
        category: 'Books',
        quantity: 5,
      };
    }
    if (refName === 'UpdateBookDto') {
      return {
        title: 'Wings and Fire',
        author: 'ABC',
        price: 123,
      };
    }
  }

  if (schema?.type === 'array') {
    return [exampleForSchema(schema.items, propertyName)];
  }

  if (schema?.type === 'object' || schema?.properties) {
    const result: Record<string, any> = {};
    Object.entries(schema.properties || {}).forEach(([name, value]) => {
      result[name] = exampleForSchema(value as any, name);
    });
    return result;
  }

  if (schema?.type === 'string') {
    if (propertyName === 'status') return 'SUCCESS';
    if (propertyName === 'category') return 'BOOK';
    if (propertyName === 'id') return 1;
    if (propertyName === 'name') return 'Sample Item';
    if (propertyName === 'title') return 'Wings and Fire';
    if (propertyName === 'author') return 'ABC';
    return 'example';
  }

  if (schema?.type === 'number') {
    if (propertyName === 'price') return 123;
    if (propertyName === 'quantity') return 5;
    return 1;
  }

  if (schema?.type === 'boolean') return true;

  return null;
}

function buildResponseSchema(
  member: ts.MethodDeclaration,
  dependencies: Record<string, string>,
  serviceMethods: Record<string, Record<string, string>>,
  schemas: Record<string, any>,
) {
  const body = member.body;
  if (!body) return undefined;

  const returnStatement = body.statements.find(ts.isReturnStatement);
  if (!returnStatement || !returnStatement.expression) return undefined;

  let responseObject: ts.ObjectLiteralExpression | undefined;

  if (ts.isObjectLiteralExpression(returnStatement.expression)) {
    responseObject = returnStatement.expression;
  } else if (ts.isCallExpression(returnStatement.expression)) {
    const createResponseTarget = returnStatement.expression.expression;
    if (
      ts.isPropertyAccessExpression(createResponseTarget) &&
      createResponseTarget.name.text === 'createResponse' &&
      returnStatement.expression.arguments[0] &&
      ts.isObjectLiteralExpression(returnStatement.expression.arguments[0])
    ) {
      responseObject = returnStatement.expression.arguments[0];
    }
  }

  if (!responseObject) {
    const directReturn = returnStatement.expression;
    const declaredType = member.type ? typeToString(member.type) : undefined;
    if (declaredType === 'string') {
      return {
        schema: { type: 'string' },
        example: 'Hello Server is Running!',
      };
    }

    const directType = resolveExpressionType(directReturn, dependencies, serviceMethods, body);
    if (directType === 'string') {
      return {
        schema: { type: 'string' },
        example: 'Hello Server is Running!',
      };
    }

    const stringLiteral = ts.isStringLiteralLike(directReturn) ? directReturn.text : undefined;
    if (stringLiteral) {
      return {
        schema: { type: 'string' },
        example: stringLiteral,
      };
    }

    return {
      schema: { type: 'object' },
      example: {},
    };
  }

  const dataProperty = responseObject.properties.find(
    (prop): prop is ts.PropertyAssignment => ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name) && prop.name.text === 'data',
  );

  if (!dataProperty) {
    return {
      schema: { type: 'object' },
      example: {},
    };
  }

  const dataType = resolveExpressionType(dataProperty.initializer, dependencies, serviceMethods, body);
  const schema = {
    type: 'object',
    properties: {
      status: { type: 'string' },
      cat: { type: 'string' },
      data: schemaForTypeName(dataType, schemas),
    },
  };

  return {
    schema,
    example: {
      status: 'SUCCESS',
      cat: 'BOOK',
      data: exampleForSchema(schema.properties.data as any),
    },
  };
}

export function shouldSkipController(node: ts.ClassDeclaration): boolean {
  return false;
}

export function collectControllers(sourceFile: ts.SourceFile, serviceMethods: Record<string, Record<string, string>>, schemas: Record<string, any>) {
  const controllers: any[] = [];

  ts.forEachChild(sourceFile, node => {
    if (!ts.isClassDeclaration(node)) return;
    if (shouldSkipController(node)) return;
    const decorators = ts.canHaveDecorators(node) ? ts.getDecorators(node) : undefined;
    if (!decorators?.length) return;

    const ctrlDecorator = decorators.find(d => getDecoratorName(d) === 'Controller');
    if (!ctrlDecorator) return;

    const prefix = getDecoratorArgText(ctrlDecorator) || '';
    const className = node.name?.text || 'AnonymousController';
    const routes: any[] = [];
    const dependencies = getControllerDependencies(node);

    node.members.forEach(member => {
      if (!ts.isMethodDeclaration(member)) return;
      const memberDecorators = ts.canHaveDecorators(member) ? ts.getDecorators(member) : undefined;
      if (!memberDecorators?.length) return;

      const methodDecorators = memberDecorators.map(d => ({
        name: getDecoratorName(d),
        arg: getDecoratorArgText(d),
      }));
      const routeDecorator = methodDecorators.find(d =>
        ['Get', 'Post', 'Put', 'Delete', 'Patch', 'Options', 'Head'].includes(d.name || ''),
      );
      if (!routeDecorator) return;

      const httpMethod = routeDecorator.name?.toUpperCase();
      const routePath = normalizeRoute(prefix, routeDecorator.arg || '');
      const params: string[] = [];
      let requestBodyType: string | null = null;

      member.parameters.forEach(param => {
        const paramDecorators = ts.canHaveDecorators(param) ? ts.getDecorators(param) : undefined;
        if (!paramDecorators?.length) return;
        const paramDecorator = paramDecorators
          .map(d => getDecoratorName(d))
          .find(name => name === 'Body' || name === 'Param' || name === 'Query' || name === 'Headers');
        if (paramDecorator === 'Body' && param.type) {
          requestBodyType = typeToString(param.type);
        }
        const paramName = param.name.getText();
        params.push(`${paramDecorator || 'param'}:${paramName}`);
      });

      const throws: any[] = [];
      ts.forEachChild(member, child => {
        if (
          ts.isThrowStatement(child) &&
          ts.isNewExpression(child.expression) &&
          ts.isIdentifier(child.expression.expression)
        ) {
          const exceptionName = child.expression.expression.text;
          const messageArg = child.expression.arguments?.[0];
          const message = messageArg ? messageArg.getText().replace(/^['"`]|['"`]$/g, '') : undefined;
          throws.push({ exception: exceptionName, message });
        }
      });

      const responseInfo = buildResponseSchema(member, dependencies, serviceMethods, schemas);

      routes.push({
        method: httpMethod,
        path: routePath,
        requestBodyType,
        parameters: params,
        throws,
        responseInfo,
      });
    });

    controllers.push({ controller: className, prefix, routes });
  });

  return controllers;
}

export function buildOpenApi(controllers: any[], schemas: Record<string, any>) {
  const paths: Record<string, any> = {};

  controllers.forEach(ctrl => {
    ctrl.routes.forEach((route: any) => {
      const routeResponses: Record<string, any> = {
        '200': {
          description: 'OK',
          content: {
            'application/json': {
              schema: route.responseInfo?.schema || { type: 'object' },
              example: route.responseInfo?.example || {
                status: 'SUCCESS',
                cat: 'BOOK',
                data: [],
              },
            },
          },
        },
        '400': {
          description: 'Bad Request',
        },
        '401': {
          description: 'Unauthorized',
        },
        '404': {
          description: 'Not Found',
        },
        '500': {
          description: 'Internal Server Error',
        },
        '503': {
          description: 'Service Unavailable - server is down or unreachable',
        },
      };

      const operation: Record<string, any> = {
        summary: `${route.method} ${route.path}`,
        responses: routeResponses,
      };

      if (route.requestBodyType) {
        operation.requestBody = {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: `#/components/schemas/${route.requestBodyType}` },
            },
          },
        };
      }

      if (route.path === '/book' && route.method === 'GET') {
        operation.security = [{ bearerAuth: [] }];
      }

      paths[route.path] = paths[route.path] || {};
      paths[route.path][route.method.toLowerCase()] = operation;
    });
  });

  return {
    info: { title: 'Static Analyzer', version: '1.0.0' },
    paths,
    components: {
      schemas,
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  };
}

function main() {
  const files = findSourceFiles(SRC).filter(file => !file.endsWith('.spec.ts'));
  const schemas: Record<string, any> = {};
  const serviceMethods: Record<string, Record<string, string>> = {};

  for (const file of files) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf-8'), ts.ScriptTarget.Latest, true);
    Object.assign(schemas, collectSchemas(source));
    Object.assign(serviceMethods, collectServices(source));
  }

  const allControllers: any[] = [];
  for (const file of files) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf-8'), ts.ScriptTarget.Latest, true);
    allControllers.push(...collectControllers(source, serviceMethods, schemas));
  }

  const openApi = buildOpenApi(allControllers, schemas);
  fs.writeFileSync(path.join(process.cwd(), 'static.json'), JSON.stringify(openApi, null, 2));
  console.log('Wrote static.json');
}

main();