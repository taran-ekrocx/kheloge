import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { FeeStructuresController } from './fee-structures.controller';
import { FeeStructuresService } from './fee-structures.service';

@Module({
  imports: [DatabaseModule],
  controllers: [FeeStructuresController],
  providers: [FeeStructuresService],
})
export class FeeStructuresModule {}
