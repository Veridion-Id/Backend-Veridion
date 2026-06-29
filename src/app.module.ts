import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FirebaseModule } from './modules/firebase.module';
import { UserModule } from './modules/user.module';
import { AdminModule } from './modules/admin.module';
import { PlatformModule } from './modules/platform.module';
import { VeriffModule } from './modules/veriff.module';
import { PassModule } from './modules/pass.module';
import { HealthModule } from './modules/health.module';
import { BatchVerifyModule } from './modules/batch-verify.module';


@Module({
  imports: [
    ConfigModule.forRoot({  
      isGlobal: true,
      envFilePath: '.env',
    }),
    FirebaseModule,
    UserModule,
    AdminModule,
    PlatformModule,
    VeriffModule,
    PassModule,
    HealthModule,
    BatchVerifyModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
