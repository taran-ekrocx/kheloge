import { Module } from '@nestjs/common';
import { VenuesController } from './venues.controller';
import { VenuesService } from './venues.service';
import { CoachesModule } from '../coaches/coaches.module';
import { BatchesModule } from '../batches/batches.module';

@Module({
  imports: [CoachesModule, BatchesModule],
  controllers: [VenuesController],
  providers: [VenuesService],
  exports: [VenuesService],
})
export class VenuesModule {}
