import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GirinWalletController } from './girin-wallet/girin-wallet.controller';
import { GirinWalletService } from './girin-wallet/girin-wallet.service';

@Module({
  imports: [],
  controllers: [AppController, GirinWalletController],
  providers: [AppService, GirinWalletService]
})
export class AppModule {}
