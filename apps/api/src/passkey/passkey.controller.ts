import { Body, Controller, Post } from '@nestjs/common';
import { PasskeyService } from './passkey.service';
import type { RegistrationResponseJSON, AuthenticationResponseJSON } from '@simplewebauthn/types';
import { Public } from '../auth/public.decorator';

@Controller('api/passkey')
export class PasskeyController {
  constructor(private readonly passkeyService: PasskeyService) {}

  @Public()
  @Post('register/challenge')
  async registerChallenge(@Body() body: { userId: string }) {
    return this.passkeyService.generateRegistrationChallenge(body.userId);
  }

  @Public()
  @Post('register/verify')
  async registerVerify(
    @Body()
    body: {
      userId: string;
      credential: RegistrationResponseJSON;
    },
  ) {
    return this.passkeyService.verifyRegistration(body.userId, body.credential);
  }

  @Public()
  @Post('login/challenge')
  async loginChallenge(@Body() body: { email: string }) {
    return this.passkeyService.generateAuthenticationChallenge(body.email);
  }

  @Public()
  @Post('login/verify')
  async loginVerify(
    @Body()
    body: {
      credential: AuthenticationResponseJSON;
    },
  ) {
    return this.passkeyService.verifyAuthentication(body.credential);
  }
}
