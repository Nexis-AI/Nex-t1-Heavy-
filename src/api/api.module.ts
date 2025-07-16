import { Module } from '@nestjs/common';
import { AgentsController } from './controllers/agents.controller';
import { TasksController } from './controllers/tasks.controller';
import { SystemController } from './controllers/system.controller';
import { HealthModule } from './health/health.module';
import { OrchestratorModule } from '@core/orchestrator/orchestrator.module';
import { StateManagerModule } from '@core/state/state-manager.module';
import { MessageBusModule } from '@core/communication/message-bus.module';
import { TaskDispatcherModule } from '@core/tasks/task-dispatcher.module';

@Module({
  imports: [
    HealthModule,
    OrchestratorModule,
    StateManagerModule,
    MessageBusModule,
    TaskDispatcherModule,
  ],
  controllers: [
    AgentsController,
    TasksController,
    SystemController,
  ],
})
export class ApiModule {}