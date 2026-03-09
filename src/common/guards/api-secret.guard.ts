import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class ApiSecretGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiSecret = request.headers['x-api-secret'];
    const expected = process.env.API_SECRET;

    if (!expected || !apiSecret || apiSecret !== expected) {
      console.warn('[GUARD] Unauthorized API access attempt');
      throw new UnauthorizedException('Invalid or missing API secret');
    }

    return true;
  }
}
