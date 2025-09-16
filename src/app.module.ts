import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FirebaseModule } from './modules/firebase.module';
import { UserModule } from './modules/user.module';
import { AdminModule } from './modules/admin.module';
import { PlatformModule } from './modules/platform.module';
import { VeriffModule } from './modules/veriff.module';


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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
