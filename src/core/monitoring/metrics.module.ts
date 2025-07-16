import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MetricsService } from './metrics.service';

@Module({
  imports: [EventEmitterModule],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}