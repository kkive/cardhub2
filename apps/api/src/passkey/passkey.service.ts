import { Inject, Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { REDIS_CLIENT } from '../redis/redis.module';
import Redis from 'ioredis';
import { randomBytes } from 'crypto';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from '@simplewebauthn/types';

const CHALLENGE_TTL = 300; // 5 minutes

@Injectable()
export class PasskeyService {
  private rpId: string;
  private origin: string;
  private rpName: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    this.rpId = this.config.get('PASSKEY_RP_ID', 'localhost');
    this.origin = this.config.get('PASSKEY_ORIGIN', 'http://localhost:8000');
    this.rpName = this.config.get('PASSKEY_RP_NAME', 'Cards hub');
  }

  async generateRegistrationChallenge(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const existingCredentials = await this.prisma.passkeyCredential.findMany({
      where: { userId },
    });

    const regOptions = await generateRegistrationOptions({
      rpName: this.rpName,
      rpID: this.rpId,
      userName: user.email,
      userDisplayName: user.username,
      userID: Buffer.from(user.id),
      attestationType: 'none',
      excludeCredentials: existingCredentials.map((c) => ({
        id: c.credentialId,
        transports: c.transports ? JSON.parse(c.transports) : undefined,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    const challengeKey = `passkey:reg:${userId}`;
    await this.redis.set(challengeKey, regOptions.challenge, 'EX', CHALLENGE_TTL);

    return regOptions;
  }

  async verifyRegistration(
    userId: string,
    credential: RegistrationResponseJSON,
  ) {
    const challengeKey = `passkey:reg:${userId}`;
    const storedChallenge = await this.redis.get(challengeKey);
    if (!storedChallenge) {
      throw new BadRequestException('Challenge expired or not found');
    }

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: credential,
        expectedChallenge: storedChallenge,
        expectedOrigin: this.origin,
        expectedRPID: this.rpId,
      });
    } catch (err: any) {
      throw new BadRequestException(`Registration verification failed: ${err.message}`);
    }

    if (!verification.verified || !verification.registrationInfo) {
      throw new BadRequestException('Registration verification failed');
    }

    const { credentialID, credentialPublicKey, counter, credentialDeviceType } =
      verification.registrationInfo;

    await this.prisma.passkeyCredential.create({
      data: {
        userId,
        credentialId: credentialID,
        publicKey: Buffer.from(credentialPublicKey),
        counter: BigInt(counter),
        transports: credential.response?.transports
          ? JSON.stringify(credential.response.transports)
          : null,
        authenticatorType: credentialDeviceType,
      },
    });

    await this.redis.del(challengeKey);

    return { success: true, credentialId: credentialID };
  }

  async generateAuthenticationChallenge(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new NotFoundException('User not found');

    const credentials = await this.prisma.passkeyCredential.findMany({
      where: { userId: user.id },
    });

    const options = await generateAuthenticationOptions({
      rpID: this.rpId,
      userVerification: 'preferred',
      allowCredentials: credentials.map((c) => ({
        id: c.credentialId,
        transports: c.transports ? JSON.parse(c.transports) as AuthenticatorTransportFuture[] : undefined,
      })),
    });

    const challengeKey = `passkey:auth:${user.id}`;
    await this.redis.set(challengeKey, options.challenge, 'EX', CHALLENGE_TTL);

    return options;
  }

  async verifyAuthentication(credential: AuthenticationResponseJSON) {
    const passkey = await this.prisma.passkeyCredential.findUnique({
      where: { credentialId: credential.id },
      include: { user: true },
    });
    if (!passkey) throw new NotFoundException('Credential not found');

    const challengeKey = `passkey:auth:${passkey.userId}`;
    const storedChallenge = await this.redis.get(challengeKey);
    if (!storedChallenge) {
      throw new BadRequestException('Challenge expired or not found');
    }

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: credential,
        expectedChallenge: storedChallenge,
        expectedOrigin: this.origin,
        expectedRPID: this.rpId,
        authenticator: {
          credentialID: passkey.credentialId,
          credentialPublicKey: Buffer.from(passkey.publicKey),
          counter: Number(passkey.counter),
        },
      });
    } catch (err: any) {
      throw new BadRequestException(`Authentication verification failed: ${err.message}`);
    }

    if (!verification.verified) {
      throw new BadRequestException('Authentication verification failed');
    }

    // Update counter to prevent replay attacks
    await this.prisma.passkeyCredential.update({
      where: { id: passkey.id },
      data: { counter: BigInt(verification.authenticationInfo.newCounter) },
    });

    await this.redis.del(challengeKey);

    return {
      success: true,
      user: {
        id: passkey.user.id,
        email: passkey.user.email,
        username: passkey.user.username,
        role: passkey.user.role,
      },
    };
  }
}
