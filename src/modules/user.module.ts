import { Module } from '@nestjs/common';
import { UserService } from '../application/services/user.service';
import { UserController } from '../interfaces/controllers/user.controller';
import { FirebaseModule } from './firebase.module';

@Module({
  imports: [FirebaseModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
