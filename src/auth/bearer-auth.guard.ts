import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class BearerAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const authHeader = req.headers?.authorization;

    const expectedToken = process.env.AUTH_TOKEN;

    if (!authHeader || typeof authHeader !== 'string'|| authHeader !== `Bearer ${expectedToken}`) {
      throw new UnauthorizedException('Invalid or missing bearer token');
    }

    return true;
  }
}
