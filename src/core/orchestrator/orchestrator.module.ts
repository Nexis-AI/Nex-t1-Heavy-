import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { OrchestratorService } from './orchestrator.service';

@Module({
  imports: [
    EventEmitterModule,
    BullModule.registerQueue({
      name: 'orchestrator',
    }),
  ],
  providers: [OrchestratorService],
  exports: [OrchestratorService],
})
export class OrchestratorModule {}