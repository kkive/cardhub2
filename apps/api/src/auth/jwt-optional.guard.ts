import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Like JwtAuthGuard but does NOT reject unauthenticated requests.
 * If a valid JWT is present, req.user is populated; otherwise the
 * request proceeds with req.user = undefined.
 */
@Injectable()
export class JwtOptionalGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest<TUser = any>(err: any, user: TUser): TUser | null {
    // Swallow auth errors — this is optional auth
    return user ?? (null as any);
  }
}
