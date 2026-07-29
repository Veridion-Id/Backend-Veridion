import { Module } from '@nestjs/common';
import { VeriffService } from '../application/services/veriff.service';
import { VeriffController } from '../interfaces/controllers/veriff.controller';
import { AdminModule } from './admin.module';
import { FirebaseModule } from './firebase.module';

@Module({
  imports: [AdminModule, FirebaseModule],
  controllers: [VeriffController],
  providers: [VeriffService],
  exports: [VeriffService],
})
export class VeriffModule {}
