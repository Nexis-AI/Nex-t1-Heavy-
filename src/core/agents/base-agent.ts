import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import type {
  AgentCapabilities,
  AgentConfig,
  AgentMessage,
  AgentMetrics,
  AgentPersona,
  AgentState,
  AgentStatus,
  AgentTraits,
  IAgent,
  Task,
} from '@interfaces/agent.interface';

export abstract class BaseAgent extends EventEmitter implements IAgent {
  public readonly id: string;
  public readonly persona: AgentPersona;
  public state: AgentState = 'idle';
  public readonly traits: AgentTraits;
  public readonly capabilities: AgentCapabilities;
  public currentTasks: Task[] = [];
  public metrics: AgentMetrics;

  protected config: AgentConfig;
  private messageQueue: AgentMessage[] = [];
  private lastActivity: Date = new Date();

  constructor(config: AgentConfig) {
    super();
    this.id = uuidv4();
    this.persona = config.persona;
    this.traits = config.traits;
    this.config = config;
    this.capabilities = this.defineCapabilities();
    this.metrics = this.initializeMetrics();
  }

  abstract defineCapabilities(): AgentCapabilities;

  async initialize(): Promise<void> {
    this.state = 'idle';
    this.emit('agent:initialized', {
      agentId: this.id,
      persona: this.persona,
      timestamp: new Date(),
    });
    
    await this.loadMemory();
    await this.setupTools();
    this.startHeartbeat();
  }

  async processMessage(message: AgentMessage): Promise<void> {
    this.messageQueue.push(message);
    this.emit('message:received', message);

    if (this.state === 'idle') {
      await this.processMessageQueue();
    }
  }

  async executeTask(task: Task): Promise<void> {
    this.state = 'working';
    this.currentTasks.push(task);
    this.emit('task:started', { agentId: this.id, task });

    try {
      await this.validateTask(task);
      const result = await this.performTask(task);
      await this.reportTaskCompletion(task, result);
      
      this.updateMetrics('tasksCompleted', this.metrics.tasksCompleted + 1);
      this.state = 'idle';
    } catch (error) {
      this.state = 'blocked';
      await this.handleTaskError(task, error);
      throw error;
    } finally {
      this.currentTasks = this.currentTasks.filter(t => t.id !== task.id);
      this.updateLastActivity();
    }
  }

  async collaborate(withAgent: AgentPersona, context: any): Promise<void> {
    const collaborationMessage: AgentMessage = {
      id: uuidv4(),
      fromAgent: this.persona,
      toAgent: withAgent,
      messageType: 'TASK',
      payload: {
        type: 'collaboration_request',
        context,
        requiredCapabilities: this.getRequiredCapabilities(context),
      },
      priority: 'MEDIUM',
      timestamp: new Date(),
    };

    this.emit('collaboration:initiated', {
      fromAgent: this.persona,
      toAgent: withAgent,
      context,
    });

    await this.sendMessage(collaborationMessage);
  }

  reportStatus(): AgentStatus {
    return {
      agentId: this.id,
      persona: this.persona,
      state: this.state,
      currentLoad: this.calculateCurrentLoad(),
      availability: this.isAvailable(),
      lastActivity: this.lastActivity,
      activeTaskCount: this.currentTasks.length,
    };
  }

  async shutdown(): Promise<void> {
    this.state = 'idle';
    await this.saveMemory();
    await this.cleanupResources();
    this.removeAllListeners();
    this.emit('agent:shutdown', { agentId: this.id, timestamp: new Date() });
  }

  async pause(): Promise<void> {
    this.state = 'paused';
    this.emit('agent:paused', { agentId: this.id, timestamp: new Date() });
  }

  async resume(): Promise<void> {
    this.state = 'idle';
    this.emit('agent:resumed', { agentId: this.id, timestamp: new Date() });
    await this.processMessageQueue();
  }

  protected abstract performTask(task: Task): Promise<any>;
  protected abstract validateTask(task: Task): Promise<void>;
  protected abstract loadMemory(): Promise<void>;
  protected abstract saveMemory(): Promise<void>;
  protected abstract setupTools(): Promise<void>;

  protected async processMessageQueue(): Promise<void> {
    while (this.messageQueue.length > 0 && this.state === 'idle') {
      const message = this.messageQueue.shift();
      if (message) {
        await this.handleMessage(message);
      }
    }
  }

  protected async handleMessage(message: AgentMessage): Promise<void> {
    switch (message.messageType) {
      case 'TASK':
        await this.handleTaskMessage(message);
        break;
      case 'QUERY':
        await this.handleQueryMessage(message);
        break;
      case 'RESPONSE':
        await this.handleResponseMessage(message);
        break;
      case 'CRITIQUE':
        await this.handleCritiqueMessage(message);
        break;
      default:
        console.warn(`Unknown message type: ${message.messageType}`);
    }
  }

  protected async sendMessage(message: AgentMessage): Promise<void> {
    this.emit('message:send', message);
  }

  protected updateMetrics(key: keyof AgentMetrics, value: any): void {
    this.metrics = { ...this.metrics, [key]: value };
    this.emit('metrics:updated', { agentId: this.id, metrics: this.metrics });
  }

  private initializeMetrics(): AgentMetrics {
    return {
      tasksCompleted: 0,
      tasksInProgress: 0,
      averageCompletionTime: 0,
      qualityScore: 1.0,
      collaborationScore: 1.0,
    };
  }

  private calculateCurrentLoad(): number {
    const taskWeight = this.currentTasks.reduce((sum, task) => {
      const priorityWeight = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
      return sum + priorityWeight[task.priority];
    }, 0);
    
    return Math.min(taskWeight / 10, 1.0);
  }

  private isAvailable(): boolean {
    return this.state === 'idle' && this.currentTasks.length < 3;
  }

  private updateLastActivity(): void {
    this.lastActivity = new Date();
  }

  private startHeartbeat(): void {
    setInterval(() => {
      this.emit('heartbeat', {
        agentId: this.id,
        status: this.reportStatus(),
        timestamp: new Date(),
      });
    }, 30000);
  }

  private async handleTaskMessage(message: AgentMessage): Promise<void> {
    const task = message.payload as Task;
    await this.executeTask(task);
  }

  private async handleQueryMessage(message: AgentMessage): Promise<void> {
    this.emit('query:received', message);
  }

  private async handleResponseMessage(message: AgentMessage): Promise<void> {
    this.emit('response:received', message);
  }

  private async handleCritiqueMessage(message: AgentMessage): Promise<void> {
    this.emit('critique:received', message);
  }

  private async reportTaskCompletion(task: Task, result: any): Promise<void> {
    this.emit('task:completed', {
      agentId: this.id,
      task,
      result,
      timestamp: new Date(),
    });
  }

  private async handleTaskError(task: Task, error: any): Promise<void> {
    this.emit('task:error', {
      agentId: this.id,
      task,
      error: error.message || error,
      timestamp: new Date(),
    });
  }

  private getRequiredCapabilities(context: any): string[] {
    return context.requiredCapabilities || [];
  }

  private async cleanupResources(): Promise<void> {
    this.messageQueue = [];
    this.currentTasks = [];
  }
}