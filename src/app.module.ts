import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { FirebaseModule } from './modules/firebase.module';
import { UserModule } from './modules/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({  
      isGlobal: true,
      envFilePath: '.env',
    }),
    FirebaseModule,
    UserModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
