import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { OrgScopeMiddleware } from './common/middleware/org-scope.middleware';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';
import { AuthModule } from './modules/auth/auth.module';
import { VenuesModule } from './modules/venues/venues.module';
import { SportsModule } from './modules/sports/sports.module';
import { CitiesModule } from './modules/cities/cities.module';
import { UsersModule } from './modules/users/users.module';
import { StudentsModule } from './modules/students/students.module';
import { BatchesModule } from './modules/batches/batches.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { EnquiriesModule } from './modules/enquiries/enquiries.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { ReportsModule } from './modules/reports/reports.module';
import { CoachesModule } from './modules/coaches/coaches.module';
import { FeeStructuresModule } from './modules/fee-structures/fee-structures.module';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get('REDIS_PASSWORD'),
        },
      }),
    }),
    DatabaseModule,
    AuthModule,
    VenuesModule,
    SportsModule,
    CitiesModule,
    UsersModule,
    StudentsModule,
    BatchesModule,
    AttendanceModule,
    PaymentsModule,
    EnquiriesModule,
    InvoicesModule,
    NotificationsModule,
    UploadsModule,
    ReportsModule,
    CoachesModule,
    FeeStructuresModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(OrgScopeMiddleware)
      .exclude(
        { path: 'auth/(.*)', method: RequestMethod.ALL },
        { path: 'webhooks/(.*)', method: RequestMethod.ALL },
      )
      .forRoutes('*');
  }
}
