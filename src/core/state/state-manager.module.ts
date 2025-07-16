import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { StateManagerService } from './state-manager.service';

@Module({
  imports: [EventEmitterModule],
  providers: [StateManagerService],
  exports: [StateManagerService],
})
export class StateManagerModule {}