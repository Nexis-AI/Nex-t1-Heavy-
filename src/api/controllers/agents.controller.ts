import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { AgentPersona, AgentStatus } from '@interfaces/agent.interface';
import { OrchestratorService } from '@core/orchestrator/orchestrator.service';
import { StateManagerService } from '@core/state/state-manager.service';

interface AgentListResponse {
  agents: AgentInfo[];
  total: number;
}

interface AgentInfo {
  persona: AgentPersona;
  status: AgentStatus;
  state: any;
  metrics: any;
}

@Controller('api/agents')
export class AgentsController {
  constructor(
    private orchestratorService: OrchestratorService,
    private stateManager: StateManagerService,
    private eventEmitter: EventEmitter2,
  ) {}

  @Get()
  async listAgents(): Promise<AgentListResponse> {
    const systemState = await this.stateManager.getSystemState();
    const agents: AgentInfo[] = [];

    for (const [persona, agentState] of systemState.agents) {
      const status = this.orchestratorService.activeAgents.get(persona);
      
      if (status) {
        agents.push({
          persona,
          status,
          state: agentState,
          metrics: agentState.metrics,
        });
      }
    }

    return {
      agents,
      total: agents.length,
    };
  }

  @Get(':persona')
  async getAgent(@Param('persona') persona: AgentPersona): Promise<AgentInfo> {
    const status = this.orchestratorService.activeAgents.get(persona);
    const state = await this.stateManager.getAgentState(persona);

    if (!status || !state) {
      throw new HttpException(
        `Agent not found: ${persona}`,
        HttpStatus.NOT_FOUND,
      );
    }

    return {
      persona,
      status,
      state,
      metrics: state.metrics,
    };
  }

  @Post(':persona/pause')
  async pauseAgent(@Param('persona') persona: AgentPersona): Promise<any> {
    try {
      await this.orchestratorService.pauseAgent(persona);
      
      return {
        success: true,
        message: `Agent ${persona} paused successfully`,
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to pause agent',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':persona/resume')
  async resumeAgent(@Param('persona') persona: AgentPersona): Promise<any> {
    try {
      await this.orchestratorService.resumeAgent(persona);
      
      return {
        success: true,
        message: `Agent ${persona} resumed successfully`,
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to resume agent',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':persona/memory')
  async getAgentMemory(
    @Param('persona') persona: AgentPersona,
    @Query('type') memoryType: 'shortTerm' | 'longTerm' = 'shortTerm',
  ): Promise<any> {
    const memory = await this.stateManager.getAgentMemory(persona, memoryType);
    
    return {
      persona,
      memoryType,
      memory,
    };
  }

  @Put(':persona/memory')
  async updateAgentMemory(
    @Param('persona') persona: AgentPersona,
    @Body() body: { type: 'shortTerm' | 'longTerm'; key: string; value: any },
  ): Promise<any> {
    await this.stateManager.updateAgentMemory(
      persona,
      body.type,
      body.key,
      body.value,
    );
    
    return {
      success: true,
      message: 'Memory updated successfully',
    };
  }

  @Post(':persona/memory/clear')
  async clearShortTermMemory(
    @Param('persona') persona: AgentPersona,
  ): Promise<any> {
    await this.stateManager.clearShortTermMemory(persona);
    
    return {
      success: true,
      message: 'Short-term memory cleared',
    };
  }

  @Get('metrics/summary')
  async getMetricsSummary(): Promise<any> {
    const systemState = await this.stateManager.getSystemState();
    const summary: any = {
      totalAgents: systemState.agents.size,
      activeAgents: 0,
      totalTasksCompleted: 0,
      averageSuccessRate: 0,
      byAgent: {},
    };

    for (const [persona, state] of systemState.agents) {
      if (state.state !== 'idle') {
        summary.activeAgents++;
      }
      
      summary.totalTasksCompleted += state.metrics.tasksCompleted;
      summary.averageSuccessRate += state.metrics.successRate || 0;
      
      summary.byAgent[persona] = {
        tasksCompleted: state.metrics.tasksCompleted,
        successRate: state.metrics.successRate,
        currentTasks: state.currentTasks.length,
      };
    }

    summary.averageSuccessRate /= systemState.agents.size;

    return summary;
  }

  @Post('broadcast')
  async broadcastMessage(@Body() body: { message: string; priority?: string }): Promise<any> {
    this.eventEmitter.emit('system:broadcast', {
      message: body.message,
      priority: body.priority || 'MEDIUM',
      timestamp: new Date(),
    });
    
    return {
      success: true,
      message: 'Broadcast sent to all agents',
    };
  }
}