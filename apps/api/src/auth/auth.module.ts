import { Global, Module } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { MembershipService } from './membership.service';

@Global()
@Module({ providers: [AuthGuard, MembershipService], exports: [AuthGuard, MembershipService] })
export class AuthModule {}
