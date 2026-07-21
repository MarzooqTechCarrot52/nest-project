import { ExecutionContext } from '@nestjs/common';
import { BearerAuthGuard } from './bearer-auth.guard';

describe('BearerAuthGuard', () => {
  let guard: BearerAuthGuard;

  beforeEach(() => {
    guard = new BearerAuthGuard();
  });

  it('allows requests with a bearer token', () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization: 'Bearer secret-token' } }),
      }),
    } as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects requests without a bearer token', () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: {} }),
      }),
    } as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow('Bearer token is required');
  });
});
