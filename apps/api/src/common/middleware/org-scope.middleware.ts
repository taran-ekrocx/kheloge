import { Injectable, NestMiddleware } from '@nestjs/common';
import { JwtPayload } from '@kheloge/shared';

/**
 * Decodes the Bearer JWT (without verification — Passport JwtGuard verifies)
 * and attaches tenantOrgId to every request early in the pipeline.
 * Routes that require auth will still be rejected by AuthGuard('jwt') if
 * the token is missing or invalid; this middleware only enriches valid requests.
 */
@Injectable()
export class OrgScopeMiddleware implements NestMiddleware {
  use(req: any, _res: any, next: () => void): void {
    const authHeader: string | undefined = req.headers?.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(
            Buffer.from(parts[1], 'base64url').toString('utf8'),
          ) as JwtPayload;
          if (payload?.orgId) {
            req.tenantOrgId = payload.orgId;
          }
        }
      } catch {
        // Malformed JWT — let AuthGuard handle rejection downstream
      }
    }
    next();
  }
}
