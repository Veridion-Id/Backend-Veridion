import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FirebaseService } from '../infrastructure/firebase/firebase.adapter';
import firebaseConfig from '../config/firebase.config';

@Module({
  imports: [
    ConfigModule.forFeature(firebaseConfig),
  ],
  providers: [FirebaseService],
  exports: [FirebaseService],
})
export class FirebaseModule {}
