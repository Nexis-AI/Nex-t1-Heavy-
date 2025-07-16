import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TaskDispatcherService } from './task-dispatcher.service';

@Module({
  imports: [EventEmitterModule],
  providers: [TaskDispatcherService],
  exports: [TaskDispatcherService],
})
export class TaskDispatcherModule {}