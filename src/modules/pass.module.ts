import { Module } from '@nestjs/common'
import { PassController } from '../interfaces/controllers/pass.controller'

@Module({
  controllers: [PassController],
})
export class PassModule {}
