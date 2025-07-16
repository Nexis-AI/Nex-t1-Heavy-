import { BaseAgent } from './base-agent';
import type { AgentConfig, Task } from '@interfaces/agent.interface';

class TestAgent extends BaseAgent {
  defineCapabilities() {
    return {
      languages: ['typescript'],
      frameworks: ['nestjs'],
      specialties: ['testing'],
    };
  }

  protected async performTask(task: Task): Promise<any> {
    return { status: 'completed', taskId: task.id };
  }

  protected async validateTask(task: Task): Promise<void> {
    if (!task.title) {
      throw new Error('Task must have a title');
    }
  }

  protected async loadMemory(): Promise<void> {
    // Mock implementation
  }

  protected async saveMemory(): Promise<void> {
    // Mock implementation
  }

  protected async setupTools(): Promise<void> {
    // Mock implementation
  }
}

describe('BaseAgent', () => {
  let agent: TestAgent;
  let config: AgentConfig;

  beforeEach(() => {
    config = {
      persona: 'tech_lead',
      traits: {
        leadership: 0.9,
        technical_depth: 0.85,
      },
      responsibilities: ['architecture', 'team leadership'],
      communicationStyle: {
        tone: 'professional',
        verbosity: 'concise',
        technicalLevel: 'high',
      },
    };
    agent = new TestAgent(config);
  });

  afterEach(() => {
    agent.removeAllListeners();
  });

  describe('constructor', () => {
    it('should create an agent with correct properties', () => {
      expect(agent.persona).toBe('tech_lead');
      expect(agent.traits).toEqual(config.traits);
      expect(agent.state).toBe('idle');
      expect(agent.currentTasks).toEqual([]);
    });

    it('should generate a unique ID', () => {
      const agent2 = new TestAgent(config);
      expect(agent.id).toBeDefined();
      expect(agent2.id).toBeDefined();
      expect(agent.id).not.toBe(agent2.id);
    });
  });

  describe('initialize', () => {
    it('should initialize agent and emit event', async () => {
      const initSpy = jest.fn();
      agent.on('agent:initialized', initSpy);

      await agent.initialize();

      expect(initSpy).toHaveBeenCalledWith({
        agentId: agent.id,
        persona: 'tech_lead',
        timestamp: expect.any(Date),
      });
    });
  });

  describe('executeTask', () => {
    it('should execute a valid task successfully', async () => {
      const task: Task = {
        id: 'task-1',
        title: 'Test Task',
        description: 'Test description',
        assignedTo: 'tech_lead',
        priority: 'HIGH',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const startSpy = jest.fn();
      const completeSpy = jest.fn();
      agent.on('task:started', startSpy);
      agent.on('task:completed', completeSpy);

      await agent.executeTask(task);

      expect(startSpy).toHaveBeenCalledWith({
        agentId: agent.id,
        task,
      });
      expect(completeSpy).toHaveBeenCalledWith({
        agentId: agent.id,
        task,
        result: { status: 'completed', taskId: 'task-1' },
        timestamp: expect.any(Date),
      });
      expect(agent.metrics.tasksCompleted).toBe(1);
    });

    it('should handle task validation errors', async () => {
      const invalidTask: Task = {
        id: 'task-2',
        title: '',
        description: 'Test description',
        assignedTo: 'tech_lead',
        priority: 'HIGH',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const errorSpy = jest.fn();
      agent.on('task:error', errorSpy);

      await expect(agent.executeTask(invalidTask)).rejects.toThrow(
        'Task must have a title',
      );

      expect(errorSpy).toHaveBeenCalled();
      expect(agent.state).toBe('blocked');
    });
  });

  describe('processMessage', () => {
    it('should queue messages and process them', async () => {
      const message = {
        id: 'msg-1',
        fromAgent: 'product_engineer' as const,
        toAgent: 'tech_lead' as const,
        messageType: 'TASK' as const,
        payload: { test: true },
        priority: 'MEDIUM' as const,
        timestamp: new Date(),
      };

      const receiveSpy = jest.fn();
      agent.on('message:received', receiveSpy);

      await agent.processMessage(message);

      expect(receiveSpy).toHaveBeenCalledWith(message);
    });
  });

  describe('reportStatus', () => {
    it('should return current agent status', () => {
      const status = agent.reportStatus();

      expect(status).toEqual({
        agentId: agent.id,
        persona: 'tech_lead',
        state: 'idle',
        currentLoad: 0,
        availability: true,
        lastActivity: expect.any(Date),
        activeTaskCount: 0,
      });
    });
  });

  describe('metrics', () => {
    it('should initialize metrics correctly', () => {
      expect(agent.metrics).toEqual({
        tasksCompleted: 0,
        tasksInProgress: 0,
        averageCompletionTime: 0,
        qualityScore: 1.0,
        collaborationScore: 1.0,
      });
    });

    it('should emit metrics update events', () => {
      const metricsSpy = jest.fn();
      agent.on('metrics:updated', metricsSpy);

      agent['updateMetrics']('tasksCompleted', 5);

      expect(metricsSpy).toHaveBeenCalledWith({
        agentId: agent.id,
        metrics: expect.objectContaining({
          tasksCompleted: 5,
        }),
      });
    });
  });

  describe('shutdown', () => {
    it('should shutdown agent gracefully', async () => {
      const shutdownSpy = jest.fn();
      agent.on('agent:shutdown', shutdownSpy);

      await agent.shutdown();

      expect(agent.state).toBe('idle');
      expect(shutdownSpy).toHaveBeenCalledWith({
        agentId: agent.id,
        timestamp: expect.any(Date),
      });
    });
  });
});