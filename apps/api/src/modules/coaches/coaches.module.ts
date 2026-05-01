import { Module } from '@nestjs/common';
import { CoachesController } from './coaches.controller';
import { CoachesService } from './coaches.service';
import { StudentsModule } from '../students/students.module';

@Module({
  imports: [StudentsModule],
  controllers: [CoachesController],
  providers: [CoachesService],
  exports: [CoachesService],
})
export class CoachesModule {}
