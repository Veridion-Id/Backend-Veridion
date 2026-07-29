import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FirebaseService } from '../infrastructure/firebase/firebase.adapter';
import { VeriffWebhookEventRepository } from '../infrastructure/firebase/veriff-webhook-event.repository';
import firebaseConfig from '../config/firebase.config';

@Module({
  imports: [
    ConfigModule.forFeature(firebaseConfig),
  ],
  providers: [FirebaseService, VeriffWebhookEventRepository],
  exports: [FirebaseService, VeriffWebhookEventRepository],
})
export class FirebaseModule {}
