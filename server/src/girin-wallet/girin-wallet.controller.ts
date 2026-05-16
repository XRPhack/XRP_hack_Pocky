import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';

import { GirinWalletService } from './girin-wallet.service';

@Controller('wallet/girin')
export class GirinWalletController {
  constructor(private readonly girinWalletService: GirinWalletService) {}

  @Post('sessions')
  registerSession(@Body() body: unknown) {
    return {
      ok: true,
      ...this.girinWalletService.registerSession(body)
    };
  }

  @Get('sessions/:topic')
  getSession(@Param('topic') topic: string) {
    return {
      ok: true,
      ...this.girinWalletService.getSession(topic)
    };
  }

  @Delete('sessions/:topic')
  disconnectSession(@Param('topic') topic: string) {
    return this.girinWalletService.disconnectSession(topic);
  }

  @Post('transactions/payment-draft')
  async createPaymentDraft(@Body() body: unknown) {
    return {
      ok: true,
      ...(await this.girinWalletService.createPaymentDraft(body))
    };
  }

  @Post('transactions/submit-signed')
  async submitSigned(@Body() body: unknown) {
    return {
      ok: true,
      ...(await this.girinWalletService.submitSigned(body))
    };
  }
}
