import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Queue, Worker, QueueEvents } from 'bullmq';
import type { Task, AgentPersona, Priority } from '@interfaces/agent.interface';

interface TaskQueueConfig {
  concurrency: number;
  maxRetries: number;
  retryDelay: number;
  timeout: number;
}

interface TaskPriority {
  weight: number;
  maxWaitTime: number;
}

interface TaskMetrics {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageProcessingTime: number;
  queueDepth: number;
}

@Injectable()
export class TaskDispatcherService implements OnModuleInit {
  private taskQueues: Map<AgentPersona, Queue> = new Map();
  private workers: Map<AgentPersona, Worker> = new Map();
  private queueEvents: Map<AgentPersona, QueueEvents> = new Map();
  private taskMetrics: Map<AgentPersona, TaskMetrics> = new Map();
  
  private readonly priorityWeights: Record<Priority, TaskPriority> = {
    CRITICAL: { weight: 1000, maxWaitTime: 60000 },
    HIGH: { weight: 100, maxWaitTime: 300000 },
    MEDIUM: { weight: 10, maxWaitTime: 900000 },
    LOW: { weight: 1, maxWaitTime: 3600000 },
  };

  private readonly queueConfig: TaskQueueConfig = {
    concurrency: 3,
    maxRetries: 3,
    retryDelay: 5000,
    timeout: 600000,
  };

  constructor(private readonly eventEmitter: EventEmitter2) {}

  async onModuleInit() {
    try {
      await this.initializeQueues();
      // Temporarily disable event listeners to allow app to start
      // this.setupEventListeners();
    } catch (error) {
      console.error('Failed to initialize TaskDispatcherService:', error);
    }
  }

  async dispatchTask(task: Task): Promise<string> {
    const queue = this.getOrCreateQueue(task.assignedTo);

    const jobOptions = {
      priority: this.priorityWeights[task.priority].weight,
      attempts: this.queueConfig.maxRetries,
      backoff: {
        type: 'exponential' as const,
        delay: this.queueConfig.retryDelay,
      },
      removeOnComplete: {
        age: 3600,
        count: 100,
      },
      removeOnFail: {
        age: 86400,
      },
    };

    const job = await queue.add(task.assignedTo, task, jobOptions);

    this.eventEmitter.emit('task:dispatched', {
      taskId: job.id,
      agent: task.assignedTo,
      priority: task.priority,
      timestamp: new Date(),
    });

    return job.id as string;
  }

  async bulkDispatch(tasks: Task[]): Promise<string[]> {
    const tasksByAgent = this.groupTasksByAgent(tasks);
    const dispatchedIds: string[] = [];

    for (const [agent, agentTasks] of tasksByAgent) {
      const queue = this.getOrCreateQueue(agent);
      const jobs = agentTasks.map((task) => ({
        name: agent,
        data: task,
        opts: {
          priority: this.priorityWeights[task.priority].weight,
          attempts: this.queueConfig.maxRetries,
        },
      }));

      const results = await queue.addBulk(jobs);
      dispatchedIds.push(...results.map((job) => job.id as string));
    }

    return dispatchedIds;
  }

  async getTaskStatus(taskId: string, agent: AgentPersona): Promise<any> {
    const queue = this.taskQueues.get(agent);
    if (!queue) {
      throw new Error(`Queue not found for agent: ${agent}`);
    }

    const job = await queue.getJob(taskId);
    if (!job) {
      throw new Error(`Task not found: ${taskId}`);
    }

    return {
      id: job.id,
      state: await job.getState(),
      progress: job.progress,
      attempts: job.attemptsMade,
      data: job.data,
      result: job.returnvalue,
      failedReason: job.failedReason,
      timestamp: job.timestamp,
    };
  }

  async cancelTask(taskId: string, agent: AgentPersona): Promise<void> {
    const queue = this.taskQueues.get(agent);
    if (!queue) {
      throw new Error(`Queue not found for agent: ${agent}`);
    }

    const job = await queue.getJob(taskId);
    if (job) {
      await job.remove();
      this.eventEmitter.emit('task:cancelled', {
        taskId,
        agent,
        timestamp: new Date(),
      });
    }
  }

  async pauseAgent(agent: AgentPersona): Promise<void> {
    const queue = this.taskQueues.get(agent);
    if (queue) {
      await queue.pause();
      this.eventEmitter.emit('agent:paused', { agent, timestamp: new Date() });
    }
  }

  async resumeAgent(agent: AgentPersona): Promise<void> {
    const queue = this.taskQueues.get(agent);
    if (queue) {
      await queue.resume();
      this.eventEmitter.emit('agent:resumed', { agent, timestamp: new Date() });
    }
  }

  async getQueueMetrics(agent?: AgentPersona): Promise<any> {
    if (agent) {
      return this.getAgentMetrics(agent);
    }

    const allMetrics: Record<string, any> = {};
    for (const [agentName] of this.taskQueues) {
      allMetrics[agentName] = await this.getAgentMetrics(agentName);
    }
    return allMetrics;
  }

  async retryFailedTasks(agent: AgentPersona): Promise<number> {
    const queue = this.taskQueues.get(agent);
    if (!queue) return 0;

    const failedJobs = await queue.getFailed();
    let retriedCount = 0;

    for (const job of failedJobs) {
      await job.retry();
      retriedCount++;
    }

    return retriedCount;
  }

  async clearCompletedTasks(agent: AgentPersona): Promise<void> {
    const queue = this.taskQueues.get(agent);
    if (queue) {
      await queue.clean(0, 1000, 'completed');
    }
  }

  private async initializeQueues(): Promise<void> {
    const agents: AgentPersona[] = [
      'tech_lead',
      'product_engineer',
      'qa_engineer',
      'devops_specialist',
      'doc_specialist',
      'code_reviewer',
    ];

    for (const agent of agents) {
      await this.createQueueForAgent(agent);
    }
  }

  private async createQueueForAgent(agent: AgentPersona): Promise<void> {
    const queueName = `tasks-${agent}`;
    
    const queue = new Queue(queueName, {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
      },
    });

    const worker = new Worker(
      queueName,
      async (job) => {
        this.eventEmitter.emit('task:processing', {
          taskId: job.id,
          agent,
          task: job.data,
          timestamp: new Date(),
        });

        return {
          processedAt: new Date(),
          processedBy: agent,
        };
      },
      {
        connection: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
        },
        concurrency: this.queueConfig.concurrency,
      },
    );

    const queueEvents = new QueueEvents(queueName, {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    });

    this.setupQueueEventHandlers(queueEvents, agent);

    this.taskQueues.set(agent, queue);
    this.workers.set(agent, worker);
    this.queueEvents.set(agent, queueEvents);
    this.initializeMetrics(agent);
  }

  private setupQueueEventHandlers(
    queueEvents: QueueEvents,
    agent: AgentPersona,
  ): void {
    queueEvents.on('completed', ({ jobId, returnvalue }) => {
      this.updateMetrics(agent, 'completed');
      this.eventEmitter.emit('task:completed', {
        taskId: jobId,
        agent,
        result: returnvalue,
        timestamp: new Date(),
      });
    });

    queueEvents.on('failed', ({ jobId, failedReason }) => {
      this.updateMetrics(agent, 'failed');
      this.eventEmitter.emit('task:failed', {
        taskId: jobId,
        agent,
        reason: failedReason,
        timestamp: new Date(),
      });
    });

    queueEvents.on('progress', ({ jobId, data }) => {
      this.eventEmitter.emit('task:progress', {
        taskId: jobId,
        agent,
        progress: data,
        timestamp: new Date(),
      });
    });

    queueEvents.on('stalled', ({ jobId }) => {
      this.eventEmitter.emit('task:stalled', {
        taskId: jobId,
        agent,
        timestamp: new Date(),
      });
    });
  }

  private setupEventListeners(): void {
    this.eventEmitter.on('orchestrator:task:assign', async (data) => {
      await this.dispatchTask(data.task);
    });

    this.eventEmitter.on('agent:overloaded', async (data) => {
      await this.redistributeTasks(data.agent);
    });
  }

  private getOrCreateQueue(agent: AgentPersona): Queue {
    let queue = this.taskQueues.get(agent);
    if (!queue) {
      this.createQueueForAgent(agent);
      queue = this.taskQueues.get(agent)!;
    }
    return queue;
  }

  private groupTasksByAgent(tasks: Task[]): Map<AgentPersona, Task[]> {
    const grouped = new Map<AgentPersona, Task[]>();
    
    for (const task of tasks) {
      const agentTasks = grouped.get(task.assignedTo) || [];
      agentTasks.push(task);
      grouped.set(task.assignedTo, agentTasks);
    }
    
    return grouped;
  }

  private async getAgentMetrics(agent: AgentPersona): Promise<any> {
    const queue = this.taskQueues.get(agent);
    if (!queue) return null;

    const metrics = this.taskMetrics.get(agent) || this.initializeMetrics(agent);
    const counts = await queue.getJobCounts();

    return {
      ...metrics,
      queueDepth: counts.waiting + counts.active,
      waiting: counts.waiting,
      active: counts.active,
      completed: counts.completed,
      failed: counts.failed,
      delayed: counts.delayed,
    };
  }

  private initializeMetrics(agent: AgentPersona): TaskMetrics {
    const metrics: TaskMetrics = {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      averageProcessingTime: 0,
      queueDepth: 0,
    };
    
    this.taskMetrics.set(agent, metrics);
    return metrics;
  }

  private updateMetrics(agent: AgentPersona, event: 'completed' | 'failed'): void {
    const metrics = this.taskMetrics.get(agent);
    if (!metrics) return;

    if (event === 'completed') {
      metrics.completedTasks++;
    } else if (event === 'failed') {
      metrics.failedTasks++;
    }
    
    metrics.totalTasks = metrics.completedTasks + metrics.failedTasks;
  }

  private async redistributeTasks(fromAgent: AgentPersona): Promise<void> {
    const queue = this.taskQueues.get(fromAgent);
    if (!queue) return;

    const waitingJobs = await queue.getWaiting(0, 10);
    
    for (const job of waitingJobs) {
      const task = job.data as Task;
      const alternativeAgent = await this.findAlternativeAgent(task, fromAgent);
      
      if (alternativeAgent) {
        await job.remove();
        task.assignedTo = alternativeAgent;
        await this.dispatchTask(task);
      }
    }
  }

  private async findAlternativeAgent(
    _task: Task,
    excludeAgent: AgentPersona,
  ): Promise<AgentPersona | null> {
    const agents = Array.from(this.taskQueues.keys()).filter(
      (agent) => agent !== excludeAgent,
    );

    let minQueueDepth = Infinity;
    let selectedAgent: AgentPersona | null = null;

    for (const agent of agents) {
      const metrics = await this.getAgentMetrics(agent);
      if (metrics && metrics.queueDepth < minQueueDepth) {
        minQueueDepth = metrics.queueDepth;
        selectedAgent = agent;
      }
    }

    return selectedAgent;
  }
}