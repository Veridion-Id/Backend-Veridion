import { Module } from '@nestjs/common'
import { PassController } from '../interfaces/controllers/pass.controller'
import { AdminModule } from '../modules/admin.module'

@Module({
  imports: [AdminModule],
  controllers: [PassController],
})
export class PassModule {}
