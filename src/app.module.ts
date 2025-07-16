import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule } from '@nestjs/throttler';
import { MessageBusModule } from '@core/communication/message-bus.module';
import { TaskDispatcherModule } from '@core/tasks/task-dispatcher.module';
import { OrchestratorModule } from '@core/orchestrator/orchestrator.module';
import { StateManagerModule } from '@core/state/state-manager.module';
import { ApiModule } from './api/api.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      maxListeners: 20,
    }),
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'default',
          ttl: 60000,
          limit: 100,
        },
      ],
    }),
    MessageBusModule,
    TaskDispatcherModule,
    OrchestratorModule,
    StateManagerModule,
    ApiModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}