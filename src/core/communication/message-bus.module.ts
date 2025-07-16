import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MessageBusService } from './message-bus.service';

@Module({
  imports: [EventEmitterModule],
  providers: [MessageBusService],
  exports: [MessageBusService],
})
export class MessageBusModule {}