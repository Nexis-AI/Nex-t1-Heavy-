import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import type { AgentPersona, AgentState } from '@interfaces/agent.interface';
import type { DevelopmentPhase } from '@interfaces/orchestrator.interface';

interface SystemState {
  id: string;
  phase: DevelopmentPhase;
  agents: Map<AgentPersona, AgentStateData>;
  globalContext: Record<string, any>;
  timestamp: Date;
}

interface AgentStateData {
  persona: AgentPersona;
  state: AgentState;
  memory: {
    shortTerm: Record<string, any>;
    longTerm: Record<string, any>;
  };
  currentTasks: string[];
  metrics: Record<string, number>;
  lastUpdated: Date;
}

interface StateSnapshot {
  id: string;
  systemState: SystemState;
  createdAt: Date;
  reason: string;
}

@Injectable()
export class StateManagerService implements OnModuleInit, OnModuleDestroy {
  private redis: Redis;
  private currentState: SystemState;
  private stateHistory: StateSnapshot[] = [];
  private readonly maxHistorySize = 100;
  private readonly STATE_KEY_PREFIX = 'nex-t1:state:';
  private saveInterval: NodeJS.Timeout | null = null;

  constructor(private readonly eventEmitter: EventEmitter2) {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    });

    this.currentState = this.initializeSystemState();
  }

  async onModuleInit() {
    try {
      await this.loadState();
      this.startAutoSave();
      // Temporarily disable event listeners to allow app to start
      // this.setupEventListeners();
    } catch (error) {
      console.error('Failed to initialize StateManagerService:', error);
    }
  }

  async onModuleDestroy() {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
    }
    await this.saveState('system_shutdown');
    await this.redis.quit();
  }

  async getSystemState(): Promise<SystemState> {
    return { ...this.currentState };
  }

  async getAgentState(persona: AgentPersona): Promise<AgentStateData | null> {
    return this.currentState.agents.get(persona) || null;
  }

  async updateAgentState(
    persona: AgentPersona,
    updates: Partial<AgentStateData>,
  ): Promise<void> {
    const currentAgentState = this.currentState.agents.get(persona);
    
    if (!currentAgentState) {
      throw new Error(`Agent state not found for persona: ${persona}`);
    }

    const updatedState: AgentStateData = {
      ...currentAgentState,
      ...updates,
      lastUpdated: new Date(),
    };

    this.currentState.agents.set(persona, updatedState);
    
    await this.persistAgentState(persona, updatedState);
    
    this.eventEmitter.emit('state:agent:updated', {
      persona,
      state: updatedState,
      timestamp: new Date(),
    });
  }

  async updateGlobalContext(key: string, value: any): Promise<void> {
    this.currentState.globalContext[key] = value;
    
    await this.persistGlobalContext();
    
    this.eventEmitter.emit('state:context:updated', {
      key,
      value,
      timestamp: new Date(),
    });
  }

  async setPhase(phase: DevelopmentPhase): Promise<void> {
    const previousPhase = this.currentState.phase;
    this.currentState.phase = phase;
    
    await this.createSnapshot(`phase_transition_${previousPhase}_to_${phase}`);
    
    this.eventEmitter.emit('state:phase:changed', {
      from: previousPhase,
      to: phase,
      timestamp: new Date(),
    });
  }

  async createSnapshot(reason: string): Promise<string> {
    const snapshot: StateSnapshot = {
      id: uuidv4(),
      systemState: this.deepCloneState(this.currentState),
      createdAt: new Date(),
      reason,
    };

    this.stateHistory.push(snapshot);
    
    if (this.stateHistory.length > this.maxHistorySize) {
      this.stateHistory.shift();
    }

    await this.persistSnapshot(snapshot);
    
    return snapshot.id;
  }

  async restoreSnapshot(snapshotId: string): Promise<void> {
    const snapshot = await this.loadSnapshot(snapshotId);
    
    if (!snapshot) {
      throw new Error(`Snapshot not found: ${snapshotId}`);
    }

    this.currentState = this.deepCloneState(snapshot.systemState);
    await this.saveState(`restored_from_snapshot_${snapshotId}`);
    
    this.eventEmitter.emit('state:restored', {
      snapshotId,
      timestamp: new Date(),
    });
  }

  async getStateHistory(limit: number = 10): Promise<StateSnapshot[]> {
    return this.stateHistory.slice(-limit);
  }

  async updateAgentMemory(
    persona: AgentPersona,
    memoryType: 'shortTerm' | 'longTerm',
    key: string,
    value: any,
  ): Promise<void> {
    const agentState = this.currentState.agents.get(persona);
    
    if (!agentState) {
      throw new Error(`Agent state not found for persona: ${persona}`);
    }

    agentState.memory[memoryType][key] = value;
    agentState.lastUpdated = new Date();
    
    await this.persistAgentState(persona, agentState);
  }

  async getAgentMemory(
    persona: AgentPersona,
    memoryType: 'shortTerm' | 'longTerm',
  ): Promise<Record<string, any>> {
    const agentState = this.currentState.agents.get(persona);
    
    if (!agentState) {
      return {};
    }

    return { ...agentState.memory[memoryType] };
  }

  async clearShortTermMemory(persona: AgentPersona): Promise<void> {
    const agentState = this.currentState.agents.get(persona);
    
    if (agentState) {
      agentState.memory.shortTerm = {};
      agentState.lastUpdated = new Date();
      await this.persistAgentState(persona, agentState);
    }
  }

  private initializeSystemState(): SystemState {
    const agents = new Map<AgentPersona, AgentStateData>();
    const personas: AgentPersona[] = [
      'tech_lead',
      'product_engineer',
      'qa_engineer',
      'devops_specialist',
      'doc_specialist',
      'code_reviewer',
    ];

    personas.forEach((persona) => {
      agents.set(persona, {
        persona,
        state: 'idle',
        memory: {
          shortTerm: {},
          longTerm: {},
        },
        currentTasks: [],
        metrics: {
          tasksCompleted: 0,
          successRate: 1.0,
          averageResponseTime: 0,
        },
        lastUpdated: new Date(),
      });
    });

    return {
      id: uuidv4(),
      phase: 'planning',
      agents,
      globalContext: {},
      timestamp: new Date(),
    };
  }

  private async loadState(): Promise<void> {
    try {
      const stateKey = `${this.STATE_KEY_PREFIX}current`;
      const savedState = await this.redis.get(stateKey);
      
      if (savedState) {
        const parsed = JSON.parse(savedState);
        this.currentState = this.deserializeState(parsed);
        console.log('State loaded from Redis');
      } else {
        console.log('No saved state found, using initial state');
      }
    } catch (error) {
      console.error('Error loading state:', error);
    }
  }

  private async saveState(reason: string): Promise<void> {
    try {
      const stateKey = `${this.STATE_KEY_PREFIX}current`;
      const serialized = this.serializeState(this.currentState);
      await this.redis.set(stateKey, JSON.stringify(serialized));
      
      console.log(`State saved: ${reason}`);
    } catch (error) {
      console.error('Error saving state:', error);
    }
  }

  private async persistAgentState(
    persona: AgentPersona,
    state: AgentStateData,
  ): Promise<void> {
    const key = `${this.STATE_KEY_PREFIX}agent:${persona}`;
    await this.redis.set(key, JSON.stringify(state));
  }

  private async persistGlobalContext(): Promise<void> {
    const key = `${this.STATE_KEY_PREFIX}context`;
    await this.redis.set(key, JSON.stringify(this.currentState.globalContext));
  }

  private async persistSnapshot(snapshot: StateSnapshot): Promise<void> {
    const key = `${this.STATE_KEY_PREFIX}snapshot:${snapshot.id}`;
    const serialized = this.serializeState(snapshot.systemState);
    await this.redis.set(key, JSON.stringify({
      ...snapshot,
      systemState: serialized,
    }));
    await this.redis.expire(key, 86400); // 24 hours
  }

  private async loadSnapshot(snapshotId: string): Promise<StateSnapshot | null> {
    const key = `${this.STATE_KEY_PREFIX}snapshot:${snapshotId}`;
    const data = await this.redis.get(key);
    
    if (!data) return null;
    
    const parsed = JSON.parse(data);
    return {
      ...parsed,
      systemState: this.deserializeState(parsed.systemState),
    };
  }

  private startAutoSave(): void {
    this.saveInterval = setInterval(async () => {
      await this.saveState('auto_save');
    }, 60000); // Save every minute
  }

  private setupEventListeners(): void {
    this.eventEmitter.on('agent:state:changed', async (data) => {
      await this.updateAgentState(data.persona, { state: data.state });
    });

    this.eventEmitter.on('task:assigned', async (data) => {
      const agentState = this.currentState.agents.get(data.agent);
      if (agentState) {
        agentState.currentTasks.push(data.task.id);
        await this.updateAgentState(data.agent, agentState);
      }
    });

    this.eventEmitter.on('task:completed', async (data) => {
      const agentState = this.currentState.agents.get(data.agent);
      if (agentState) {
        agentState.currentTasks = agentState.currentTasks.filter(
          (id) => id !== data.task.id,
        );
        agentState.metrics.tasksCompleted++;
        await this.updateAgentState(data.agent, agentState);
      }
    });
  }

  private deepCloneState(state: SystemState): SystemState {
    return {
      ...state,
      agents: new Map(
        Array.from(state.agents.entries()).map(([k, v]) => [
          k,
          {
            ...v,
            memory: {
              shortTerm: { ...v.memory.shortTerm },
              longTerm: { ...v.memory.longTerm },
            },
            currentTasks: [...v.currentTasks],
            metrics: { ...v.metrics },
          },
        ]),
      ),
      globalContext: { ...state.globalContext },
    };
  }

  private serializeState(state: SystemState): any {
    return {
      ...state,
      agents: Array.from(state.agents.entries()),
    };
  }

  private deserializeState(data: any): SystemState {
    return {
      ...data,
      agents: new Map(data.agents),
      timestamp: new Date(data.timestamp),
    };
  }
}