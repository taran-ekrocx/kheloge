import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { AttendanceGateway } from './attendance.gateway';
import { AttendanceScheduler } from './attendance.scheduler';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [AttendanceController],
  providers: [AttendanceGateway, AttendanceService, AttendanceScheduler],
  exports: [AttendanceService, AttendanceGateway],
})
export class AttendanceModule {}
