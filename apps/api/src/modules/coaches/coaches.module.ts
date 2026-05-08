import { Module } from '@nestjs/common';
import { CoachesController } from './coaches.controller';
import { CoachesService } from './coaches.service';
import { StudentsModule } from '../students/students.module';
import { BatchesModule } from '../batches/batches.module';

@Module({
  imports: [StudentsModule, BatchesModule],
  controllers: [CoachesController],
  providers: [CoachesService],
  exports: [CoachesService],
})
export class CoachesModule {}
