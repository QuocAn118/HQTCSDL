import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { APP_CONFIG } from '../config/config';
import type { AppConfig } from '../config/config';
import { AuthController } from './auth.controller';
import { AuthService, JWT_TTL_SECONDS } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { OwnershipGuard } from './ownership.guard';
import { RolesGuard } from './roles.guard';
import { ServiceKeyGuard } from './service-key.guard';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [APP_CONFIG],
      useFactory: (cfg: AppConfig) => ({
        secret: cfg.jwtSecret,
        signOptions: { algorithm: 'HS256', expiresIn: JWT_TTL_SECONDS },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtAuthGuard,
    RolesGuard,
    OwnershipGuard,
    ServiceKeyGuard,
  ],
  exports: [
    AuthService,
    JwtAuthGuard,
    RolesGuard,
    OwnershipGuard,
    ServiceKeyGuard,
  ],
})
export class AuthModule {}
