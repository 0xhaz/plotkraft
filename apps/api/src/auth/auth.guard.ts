import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { getAuth } from 'firebase-admin/auth';
import type { Request } from 'express';
import { FirebaseService } from '../firebase/firebase.service';

export interface AuthedRequest extends Request {
  uid: string;
}

/**
 * Verifies the caller's Firebase ID token.
 *
 * The Firestore rules protect the browser's direct reads, but this API talks to
 * Firestore through the Admin SDK, which bypasses rules entirely. Without this
 * guard the API is an unauthenticated way around the whole security model — and
 * agent endpoints spend real money per call.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly fb: FirebaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    try {
      const decoded = await getAuth().verifyIdToken(token);
      req.uid = decoded.uid;
      return true;
    } catch {
      // Deliberately opaque: never tell a caller why a token was rejected.
      throw new UnauthorizedException('Invalid token');
    }
  }
}
