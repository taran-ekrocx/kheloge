import { Module } from '@nestjs/common';
import { StudentsController } from './students.controller';
import { GlobalStudentsController } from './global-students.controller';
import { StudentsService } from './students.service';
import { DemoStudentsController, GlobalDemoStudentsController } from './demo-students.controller';
import { DemoStudentsService } from './demo-students.service';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [UploadsModule],
  controllers: [StudentsController, GlobalStudentsController, DemoStudentsController, GlobalDemoStudentsController],
  providers: [StudentsService, DemoStudentsService],
  exports: [StudentsService, DemoStudentsService],
})
export class StudentsModule {}
