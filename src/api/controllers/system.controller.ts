import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { DevelopmentPhase } from '@interfaces/orchestrator.interface';
import { OrchestratorService } from '@core/orchestrator/orchestrator.service';
import { StateManagerService } from '@core/state/state-manager.service';
import { MessageBusService } from '@core/communication/message-bus.service';
import { AgentPersona, MessageType } from '@interfaces/agent.interface';

@Controller('api/system')
export class SystemController {
  constructor(
    private orchestratorService: OrchestratorService,
    private stateManager: StateManagerService,
    private messageBus: MessageBusService,
  ) {}

  @Get('status')
  async getSystemStatus(): Promise<any> {
    const systemStatus = this.orchestratorService.getSystemStatus();
    const systemState = await this.stateManager.getSystemState();
    const messageBusHealth = await this.messageBus.healthCheck();

    return {
      status: systemStatus,
      state: {
        phase: systemState.phase,
        agentCount: systemState.agents.size,
        globalContext: Object.keys(systemState.globalContext),
      },
      health: {
        overall: systemStatus.systemHealth,
        messageBus: messageBusHealth,
        uptime: systemStatus.uptime,
      },
    };
  }

  @Get('phase')
  async getCurrentPhase(): Promise<any> {
    const state = await this.stateManager.getSystemState();
    
    return {
      currentPhase: state.phase,
      activeAgents: Array.from(this.orchestratorService.activeAgents.keys()),
    };
  }

  @Post('phase/transition')
  async transitionPhase(@Body() body: { toPhase: DevelopmentPhase }): Promise<any> {
    try {
      const success = await this.orchestratorService.transitionPhase(body.toPhase);
      
      if (!success) {
        throw new HttpException(
          'Phase transition failed - exit criteria not met',
          HttpStatus.BAD_REQUEST,
        );
      }

      await this.stateManager.setPhase(body.toPhase);
      
      return {
        success: true,
        newPhase: body.toPhase,
        message: 'Phase transition completed successfully',
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to transition phase',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('phase/initialize')
  async initializePhase(@Body() body: { phase: DevelopmentPhase }): Promise<any> {
    try {
      await this.orchestratorService.initializePhase(body.phase);
      
      return {
        success: true,
        phase: body.phase,
        message: 'Phase initialized successfully',
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to initialize phase',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('context')
  async getGlobalContext(): Promise<any> {
    const state = await this.stateManager.getSystemState();
    
    return {
      context: state.globalContext,
    };
  }

  @Post('context')
  async updateGlobalContext(@Body() body: { key: string; value: any }): Promise<any> {
    await this.stateManager.updateGlobalContext(body.key, body.value);
    
    return {
      success: true,
      message: 'Global context updated',
    };
  }

  @Get('snapshots')
  async getSnapshots(): Promise<any> {
    const history = await this.stateManager.getStateHistory(20);
    
    return {
      snapshots: history,
      total: history.length,
    };
  }

  @Post('snapshots')
  async createSnapshot(@Body() body: { reason: string }): Promise<any> {
    const snapshotId = await this.stateManager.createSnapshot(body.reason);
    
    return {
      success: true,
      snapshotId,
      message: 'Snapshot created successfully',
    };
  }

  @Post('snapshots/:snapshotId/restore')
  async restoreSnapshot(@Param('snapshotId') snapshotId: string): Promise<any> {
    try {
      await this.stateManager.restoreSnapshot(snapshotId);
      
      return {
        success: true,
        message: 'System state restored from snapshot',
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to restore snapshot',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('messages/history')
  async getMessageHistory(
    @Body() filter?: {
      fromAgent?: AgentPersona;
      toAgent?: AgentPersona;
      messageType?: MessageType;
      since?: string;
    },
  ): Promise<any> {
    const history = await this.messageBus.getMessageHistory(
      filter ? {
        ...filter,
        since: filter.since ? new Date(filter.since) : undefined,
      } : undefined,
    );
    
    return {
      messages: history,
      total: history.length,
    };
  }

  @Post('conflict/resolve')
  async resolveConflict(
    @Body() body: { agents: string[]; context: any },
  ): Promise<any> {
    try {
      const resolution = await this.orchestratorService.resolveConflict(
        body.agents as any[],
        body.context,
      );
      
      return {
        success: true,
        resolution,
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to resolve conflict',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('reset')
  async resetSystem(): Promise<any> {
    return {
      success: false,
      message: 'System reset requires manual intervention for safety',
    };
  }
}