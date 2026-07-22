import fs from 'fs';
import path from 'path';
import ts from 'typescript';

const SRC = path.join(process.cwd(), 'src');

/* ===========================================================
 * File Scanner
 * =========================================================== */

function findSourceFiles(dir: string): string[] {
    const result: string[] = [];

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            result.push(...findSourceFiles(full));
            continue;
        }

        if (
            entry.isFile() &&
            full.endsWith('.ts') &&
            !full.endsWith('.spec.ts')
        ) {
            result.push(full);
        }
    }

    return result;
}

/* ===========================================================
 * TypeScript Program
 * =========================================================== */

const sourceFiles = findSourceFiles(SRC);

const program = ts.createProgram(
    sourceFiles,
    {
        target: ts.ScriptTarget.Latest,
        module: ts.ModuleKind.CommonJS,
    },
);

const checker = program.getTypeChecker();

/* ===========================================================
 * Generic AST Visitor
 * =========================================================== */

function visit(node: ts.Node, cb: (node: ts.Node) => void) {
    cb(node);
    ts.forEachChild(node, child => visit(child, cb));
}

/* ===========================================================
 * Decorator Helpers
 * =========================================================== */

function getDecorators(node: ts.Node): readonly ts.Decorator[] {
    return ts.canHaveDecorators(node)
        ? ts.getDecorators(node) ?? []
        : [];
}

function getDecoratorName(dec: ts.Decorator): string | undefined {

    const expr = dec.expression;

    if (ts.isIdentifier(expr))
        return expr.text;

    if (
        ts.isCallExpression(expr) &&
        ts.isIdentifier(expr.expression)
    )
        return expr.expression.text;

    return undefined;
}

function getDecoratorArg(
    dec: ts.Decorator,
    index = 0,
): string | undefined {

    if (!ts.isCallExpression(dec.expression))
        return;

    const arg = dec.expression.arguments[index];

    if (!arg)
        return;

    if (ts.isStringLiteral(arg))
        return arg.text;

    return arg.getText();
}

/* ===========================================================
 * Route Helpers
 * =========================================================== */

function normalizeRoute(
    prefix = '',
    route = '',
) {

    const clean = (v: string) =>
        v.replace(/^['"`]|['"`]$/g, '').trim();

    return (
        '/' +
        [clean(prefix), clean(route)]
            .filter(Boolean)
            .join('/')
            .split('/')
            .filter(Boolean)
            .join('/')
    );
}

/* ===========================================================
 * Type Helpers
 * =========================================================== */

function typeToString(type?: ts.TypeNode): string {

    if (!type)
        return 'any';

    if (ts.isArrayTypeNode(type))
        return `${typeToString(type.elementType)}[]`;

    if (
        ts.isTypeReferenceNode(type) &&
        ts.isIdentifier(type.typeName)
    )
        return type.typeName.text;

    if (ts.isUnionTypeNode(type))
        return type.types
            .map(typeToString)
            .join(' | ');

    return type.getText();
}

function getTypeAtNode(node: ts.Node): string {

    const type = checker.getTypeAtLocation(node);

    return checker.typeToString(type);
}

/* ===========================================================
 * Property Helpers
 * =========================================================== */

function propertyName(name: ts.PropertyName): string {

    if (
        ts.isIdentifier(name) ||
        ts.isStringLiteral(name) ||
        ts.isNumericLiteral(name)
    )
        return name.text;

    return name.getText();
}

/* ===========================================================
 * Recursive Throw Collector
 * =========================================================== */

function collectThrows(node: ts.Node) {

    const throws: {
        exception: string;
        message?: string;
    }[] = [];

    visit(node, current => {

        if (!ts.isThrowStatement(current))
            return;

        const expr = current.expression;

        if (
            !expr ||
            !ts.isNewExpression(expr) ||
            !ts.isIdentifier(expr.expression)
        )
            return;

        throws.push({
            exception: expr.expression.text,
            message:
                expr.arguments?.[0]?.getText()
                    .replace(/^['"`]|['"`]$/g, ''),
        });
    });

    return throws;
}

/* ===========================================================
 * Recursive Variable Lookup
 * =========================================================== */

function findVariableDeclaration(
    body: ts.Node,
    variable: string,
): ts.VariableDeclaration | undefined {

    let found: ts.VariableDeclaration | undefined;

    visit(body, node => {

        if (found)
            return;

        if (
            ts.isVariableDeclaration(node) &&
            ts.isIdentifier(node.name) &&
            node.name.text === variable
        ) {
            found = node;
        }
    });

    return found;
}

 /* ===========================================================
 * Schema Collector
 * =========================================================== */

type SchemaMap = Record<string, any>;


function schemaFromType(
    type: ts.TypeNode | undefined,
): any {

    if (!type) {
        return {
            type: 'object',
        };
    }


    // string
    if (
        type.kind === ts.SyntaxKind.StringKeyword
    ) {
        return {
            type: 'string',
        };
    }


    // number
    if (
        type.kind === ts.SyntaxKind.NumberKeyword
    ) {
        return {
            type: 'number',
        };
    }


    // boolean
    if (
        type.kind === ts.SyntaxKind.BooleanKeyword
    ) {
        return {
            type: 'boolean',
        };
    }


    // array
    if (
        ts.isArrayTypeNode(type)
    ) {

        return {
            type: 'array',
            items: schemaFromType(
                type.elementType,
            ),
        };
    }


    // Type reference
    if (
        ts.isTypeReferenceNode(type) &&
        ts.isIdentifier(type.typeName)
    ) {

        return {
            $ref:
                `#/components/schemas/${type.typeName.text}`,
        };
    }


    // union
    if (
        ts.isUnionTypeNode(type)
    ) {

        return {
            oneOf:
                type.types.map(
                    t => schemaFromType(t),
                ),
        };
    }


    // inline object
    if (
        ts.isTypeLiteralNode(type)
    ) {

        const properties: Record<string, any> = {};

        type.members.forEach(member => {

            if (
                !ts.isPropertySignature(member) ||
                !member.name
            )
                return;


            properties[
                propertyName(member.name)
            ] =
                schemaFromType(member.type);
        });


        return {
            type: 'object',
            properties,
        };
    }


    return {
        type: 'object',
    };
}



/* ===========================================================
 * Class DTO Parser
 * =========================================================== */

function parseClassSchema(
    node: ts.ClassDeclaration,
) {

    const properties: Record<string, any> = {};


    node.members.forEach(member => {


        if (
            !ts.isPropertyDeclaration(member) ||
            !member.name
        )
            return;


        const name =
            propertyName(member.name);


        properties[name] =
            schemaFromType(member.type);

    });


    return {
        type: 'object',
        properties,
    };
}



/* ===========================================================
 * Interface Parser
 * =========================================================== */

function parseInterfaceSchema(
    node: ts.InterfaceDeclaration,
) {

    const properties: Record<string, any> = {};


    node.members.forEach(member => {


        if (
            !ts.isPropertySignature(member) ||
            !member.name
        )
            return;


        properties[
            propertyName(member.name)
        ] =
            schemaFromType(member.type);

    });


    return {
        type: 'object',
        properties,
    };
}



/* ===========================================================
 * Enum Parser
 * =========================================================== */

function parseEnumSchema(
    node: ts.EnumDeclaration,
) {

    const values =
        node.members.map(member => {

            if (
                member.initializer &&
                ts.isStringLiteral(
                    member.initializer,
                )
            ) {
                return member.initializer.text;
            }

            return member.name.getText();

        });


    return {
        type: 'string',
        enum: values,
    };
}



/* ===========================================================
 * Main Schema Collector
 * =========================================================== */

export function collectSchemas(
    sourceFile: ts.SourceFile,
): SchemaMap {


    const schemas: SchemaMap = {};


    visit(sourceFile, node => {


        /*
         * DTO classes
         */

        if (
            ts.isClassDeclaration(node) &&
            node.name &&
            (
                node.name.text.endsWith('Dto') ||
                node.name.text.endsWith('DTO')
            )
        ) {

            schemas[node.name.text] =
                parseClassSchema(node);
        }



        /*
         * Interfaces
         */

        if (
            ts.isInterfaceDeclaration(node) &&
            node.name
        ) {

            schemas[node.name.text] =
                parseInterfaceSchema(node);

        }



        /*
         * Enums
         */

        if (
            ts.isEnumDeclaration(node) &&
            node.name
        ) {

            schemas[node.name.text] =
                parseEnumSchema(node);

        }

    });


    return schemas;
}

 /* ===========================================================
 * Service Collector
 * =========================================================== */

type ServiceMap = Record<
    string,
    Record<string, string>
>;



/*
 * Remove Promise wrapper
 *
 * Promise<Book>
 * becomes
 * Book
 *
 * Promise<Book[]>
 * becomes
 * Book[]
 */

function unwrapPromise(
    typeName: string,
): string {

    const match =
        typeName.match(
            /^Promise<(.*)>$/,
        );

    return match
        ? match[1]
        : typeName;
}



/*
 * Resolve method return type
 */

function resolveMethodReturnType(
    method: ts.MethodDeclaration,
): string {


    /*
     * First priority:
     *
     * get explicit return type
     *
     * findAll(): Book[]
     */

    if (method.type) {

        return unwrapPromise(
            method.type.getText(),
        );
    }



    /*
     * Otherwise use TypeChecker
     *
     * async findAll() {}
     */

    const signature =
        checker.getSignatureFromDeclaration(
            method,
        );


    if (!signature) {
        return 'any';
    }


    const returnType =
        checker.getReturnTypeOfSignature(
            signature,
        );


    return unwrapPromise(
        checker.typeToString(
            returnType,
        ),
    );
}




/*
 * Collect service classes
 */

export function collectServices(
    sourceFile: ts.SourceFile,
): ServiceMap {


    const services: ServiceMap = {};



    visit(sourceFile, node => {


        if (
            !ts.isClassDeclaration(node) ||
            !node.name
        )
            return;



        const className =
            node.name.text;



        if (
            !className
                .toLowerCase()
                .endsWith('service')
        )
            return;



        const methods:
            Record<string,string> = {};



        node.members.forEach(member => {


            if (
                !ts.isMethodDeclaration(member) ||
                !member.name
            )
                return;



            const methodName =
                member.name.getText();



            methods[methodName] =
                resolveMethodReturnType(
                    member,
                );

        });



        if (
            Object.keys(methods).length
        ) {

            services[className] =
                methods;
        }


    });



    return services;
}

 /* ===========================================================
 * Expression Type Resolver
 * =========================================================== */


function resolveExpressionType(
    expression: ts.Expression,
): string {


    /*
     * TypeScript native inference
     *
     * Handles:
     *
     * this.service.findAll()
     * variable
     * await
     * arrays
     * objects
     */

    const type =
        checker.getTypeAtLocation(
            expression,
        );


    let result =
        checker.typeToString(type);



    /*
     * Remove Promise<>
     */

    result =
        unwrapPromise(result);



    return result || 'any';
}




/* ===========================================================
 * Example Generator
 * =========================================================== */


function exampleFromSchema(
    schema: any,
): any {


    if (!schema)
        return null;



    if (schema.$ref) {

        const name =
            schema.$ref
                .split('/')
                .pop();


        return {
            id: 1,
            name: `Example ${name}`,
        };
    }



    if (
        schema.type === 'array'
    ) {

        return [
            exampleFromSchema(
                schema.items,
            ),
        ];
    }



    if (
        schema.type === 'string'
    )
        return "example";



    if (
        schema.type === 'number'
    )
        return 1;



    if (
        schema.type === 'boolean'
    )
        return true;



    if (
        schema.type === 'object'
    ) {

        const obj:any = {};

        Object.entries(
            schema.properties || {},
        )
        .forEach(
            ([key,value])=>{
                obj[key] =
                    exampleFromSchema(
                        value,
                    );
            },
        );


        return obj;
    }



    return null;
}




/* ===========================================================
 * Convert Type Name To OpenAPI Schema
 * =========================================================== */


function schemaFromTypeName(
    name:string,
    schemas:SchemaMap,
) {


    name =
        name.replace(
            /\s/g,
            '',
        );



    if (
        name.endsWith('[]')
    ) {

        return {

            type:'array',

            items:
                schemaFromTypeName(
                    name.slice(0,-2),
                    schemas,
                ),
        };
    }



    if (
        name === 'string'
    )
        return {
            type:'string',
        };



    if (
        name === 'number'
    )
        return {
            type:'number',
        };



    if (
        name === 'boolean'
    )
        return {
            type:'boolean',
        };



    if (
        schemas[name]
    ) {

        return {

            $ref:
            `#/components/schemas/${name}`,

        };
    }



    return {
        type:'object',
    };
}





/* ===========================================================
 * Response Analyzer
 * =========================================================== */


function buildResponseSchema(
    method: ts.MethodDeclaration,
    schemas: SchemaMap,
) {


    if (!method.body)
        return undefined;



    let returnExpression:
        ts.Expression | undefined;



    visit(
        method.body,
        node=>{


            if (
                returnExpression
            )
                return;



            if (
                ts.isReturnStatement(node) &&
                node.expression
            ) {

                returnExpression =
                    node.expression;

            }

        },
    );



    if (!returnExpression)
        return undefined;



    /*
     * Infer actual return type
     */

    const typeName =
        resolveExpressionType(
            returnExpression,
        );



    const schema =
        schemaFromTypeName(
            typeName,
            schemas,
        );



    return {

        schema,

        example:
            exampleFromSchema(
                schema,
            ),

    };
}

 /* ===========================================================
 * Controller Analyzer
 * =========================================================== */


const HTTP_METHODS = [
    'Get',
    'Post',
    'Put',
    'Patch',
    'Delete',
    'Options',
    'Head',
];



type ControllerRoute = {

    method:string;

    path:string;

    requestBodyType?:string;

    parameters:string[];

    throws:any[];

    responseInfo:any;

    authentication?: Record<string, any>;

};



/* ===========================================================
 * Constructor Dependency Reader
 * =========================================================== */


function getControllerDependencies(
    node:ts.ClassDeclaration,
) {


    const result:
        Record<string,string> = {};



    const constructor =
        node.members.find(
            ts.isConstructorDeclaration,
        );


    if (!constructor)
        return result;



    constructor.parameters.forEach(param=>{


        if (
            ts.isIdentifier(param.name) &&
            param.type
        ) {

            result[param.name.text] =
                param.type.getText();

        }

    });


    return result;
}

/* ===========================================================
 * Detect Authentication
 * =========================================================== */

function detectAuthentication(
    node: ts.Node,
): Record<string, any> | undefined {


    const decorators =
        getDecorators(node);


    const authDecorator =
        decorators.find(d => {

            const name =
                getDecoratorName(d);

            return [
                'UseGuards',
                'Auth',
                'ApiBearerAuth',
            ].includes(name || '');

        });


    if (!authDecorator)
        return undefined;


    return {
        bearerAuth: ["<AUTH_KEY>"],
    };
}



/* ===========================================================
 * Controller Collector
 * =========================================================== */


export function collectControllers(
    sourceFile:ts.SourceFile,
    schemas:SchemaMap,
) {


    const controllers:any[] = [];



    visit(
        sourceFile,
        node=>{


            if (
                !ts.isClassDeclaration(node) ||
                !node.name
            )
                return;



            const decorators =
                getDecorators(node);



            const controllerDecorator =
                decorators.find(
                    d =>
                    getDecoratorName(d)
                    ===
                    'Controller',
                );



            if (!controllerDecorator)
                return;



            const prefix =
                getDecoratorArg(
                    controllerDecorator,
                ) || '';



            const className =
                node.name.text;



            const dependencies =
                getControllerDependencies(
                    node,
                );



            const routes:
                ControllerRoute[] = [];

            const controllerAuth =
                detectAuthentication(node);    



            node.members.forEach(member=>{


                if (
                    !ts.isMethodDeclaration(member)
                )
                    return;



                const methodDecorators =
                    getDecorators(member);



                if (
                    methodDecorators.length===0
                )
                    return;



                const routeDecorator =
                    methodDecorators.find(
                        d =>
                        HTTP_METHODS.includes(
                            getDecoratorName(d) || '',
                        ),
                    );



                if (!routeDecorator)
                    return;



                const httpMethod =
                    (
                    getDecoratorName(
                        routeDecorator,
                    ) || ''
                    )
                    .toUpperCase();



                const route =
                    normalizeRoute(
                        prefix,
                        getDecoratorArg(
                            routeDecorator,
                        ) || '',
                    );



                let requestBodyType:
                    string | undefined;



                const parameters:string[]=[];



                member.parameters.forEach(
                    parameter=>{


                    const decorators =
                        getDecorators(
                            parameter,
                        );



                    const decorator =
                        decorators[0];



                    if (!decorator)
                        return;



                    const name =
                        getDecoratorName(
                            decorator,
                        );



                    const parameterName =
                        parameter.name.getText();



                    parameters.push(
                        `${name}:${parameterName}`,
                    );



                    if (
                        name==='Body' &&
                        parameter.type
                    ) {

                        requestBodyType =
                            parameter.type.getText();

                    }

                });



                const throws =
                    collectThrows(
                        member,
                    );



                const responseInfo =
                    buildResponseSchema(
                        member,
                        schemas,
                    );



                routes.push({

                    method:httpMethod,

                    path:route,

                    requestBodyType,

                    parameters,

                    throws,

                    responseInfo,
                    
                    authentication: detectAuthentication(member) || controllerAuth,

                });


            });



            controllers.push({

                controller:className,

                prefix,

                routes,

            });


        },
    );



    return controllers;
}
 /* ===========================================================
 * OpenAPI Builder
 * =========================================================== */


function exceptionToStatus(
    exception:string,
): string | undefined {


    const map:
        Record<string,string> = {


        BadRequestException:
            '400',


        UnauthorizedException:
            '401',


        ForbiddenException:
            '403',


        NotFoundException:
            '404',


        ConflictException:
            '409',


        InternalServerErrorException:
            '500',

    };


    return map[exception];

}




function buildResponses(
    route:ControllerRoute,
) {


    const responses:any = {



        '200': {

            description:'Successful Response',

            content:{

                'application/json':{

                    schema:
                        route.responseInfo?.schema
                        ||
                        {
                            type:'object',
                        },


                    example:
                        route.responseInfo?.example
                        ||
                        {},

                },

            },

        },


    };




    /*
     * Add detected exceptions
     */

    route.throws.forEach(error=>{


        const status =
            exceptionToStatus(
                error.exception,
            );


        if (!status)
            return;



        responses[status]={

            description:
                error.message
                ||
                error.exception,

        };


    });




    /*
     * Default errors
     */

    const defaults = [

        '400',
        '401',
        '404',
        '500',

    ];



    defaults.forEach(code=>{


        if (!responses[code]) {


            responses[code]={

                description:
                    code,

            };

        }


    });



    return responses;

}





function hasAuthDecorator(
    controller:any,
):boolean {


    /*
     * Later this can be extended
     * for project specific guards
     */

    return false;

}





export function buildOpenApi(
    controllers:any[],
    schemas:SchemaMap,
) {


    const paths:
        Record<string,any> = {};




    controllers.forEach(controller=>{


        controller.routes.forEach(
            (route:ControllerRoute)=>{


            const operation:any={
              
            };

            if (route.authentication) {

            operation.security = [
                route.authentication,
              ];

            }

            operation.summary =
                `${route.method} ${route.path}`;



            operation.responses =
                buildResponses(
                    route,
                );




            /*
             * Request Body
             */

            if (
                route.requestBodyType
            ) {


                operation.requestBody={


                    required:true,


                    content:{


                        'application/json':{


                            schema:{


                                $ref:
                                `#/components/schemas/${route.requestBodyType}`,

                            },


                        },


                    },


                };

            }




            /*
             * Parameters
             */

            const parameters =
                route.parameters
                .filter(
                    p =>
                    !p.startsWith('Body'),
                );



            if (
                parameters.length
            ) {

                operation.parameters =
                    parameters.map(p=>{


                    const [
                        type,
                        name,
                    ] =
                    p.split(':');



                    return {

                        name,

                        in:
                        type==='Param'
                        ?
                        'path'
                        :
                        type==='Query'
                        ?
                        'query'
                        :
                        'header',


                        required:true,


                        schema:{

                            type:'string',

                        },


                    };


                });

            }





            const method =
                route.method.toLowerCase();



            if (!paths[route.path]) {

                paths[route.path]={};

            }



            paths[route.path][method] =
                operation;



        });

    });




    return {


        openapi:
            '3.0.0',



        info:{

            title:
                'Static Analyzer API',


            version:
                '1.0.0',

        },



        paths,



        components:{


            schemas,



            securitySchemes:{


                bearerAuth:{


                    type:'http',


                    scheme:'bearer',


                    bearerFormat:'JWT',

                },


            },

        },


    };

}

 /* ===========================================================
 * Main Runner
 * =========================================================== */


function loadSourceFiles(): ts.SourceFile[] {

    return sourceFiles
        .map(file => program.getSourceFile(file))
        .filter(
            (source): source is ts.SourceFile =>
                !!source
        );

}





function main() {


    console.log(
        'Starting static analyzer...',
    );



    const sources =
        loadSourceFiles();




    /*
     * ------------------------------------
     * Collect Schemas
     * ------------------------------------
     */

    const schemas:
        SchemaMap = {};



    sources.forEach(source=>{


        Object.assign(

            schemas,

            collectSchemas(
                source,
            ),

        );


    });



    console.log(
        `Schemas found: ${Object.keys(schemas).length}`,
    );




    /*
     * ------------------------------------
     * Collect Services
     * ------------------------------------
     */

    const services:
        ServiceMap = {};



    sources.forEach(source=>{


        Object.assign(

            services,

            collectServices(
                source,
            ),

        );


    });



    console.log(
        `Services found: ${Object.keys(services).length}`,
    );





    /*
     * ------------------------------------
     * Collect Controllers
     * ------------------------------------
     */

    const controllers:any[]=[];



    sources.forEach(source=>{


        controllers.push(

            ...collectControllers(

                source,

                schemas,

            ),

        );


    });



    console.log(
        `Controllers found: ${controllers.length}`,
    );





    /*
     * ------------------------------------
     * Build OpenAPI
     * ------------------------------------
     */

    const openApi =
        buildOpenApi(

            controllers,

            schemas,

        );





    const output =
        path.join(
            process.cwd(),
            'static.json',
        );



    fs.writeFileSync(

        output,

        JSON.stringify(
            openApi,
            null,
            2,
        ),

        'utf-8',

    );



    console.log(
        `Static Analyzer generated: ${output}`,
    );

}



main();