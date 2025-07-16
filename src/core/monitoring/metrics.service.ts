import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { AgentPersona } from '@interfaces/agent.interface';

interface MetricPoint {
  timestamp: Date;
  value: number;
  labels?: Record<string, string>;
}

interface MetricDefinition {
  name: string;
  type: 'counter' | 'gauge' | 'histogram';
  description: string;
  labels?: string[];
}

interface SystemMetrics {
  agentMetrics: Map<AgentPersona, AgentMetrics>;
  taskMetrics: TaskMetrics;
  systemMetrics: InfrastructureMetrics;
  performanceMetrics: PerformanceMetrics;
}

interface AgentMetrics {
  tasksProcessed: number;
  tasksSucceeded: number;
  tasksFailed: number;
  averageProcessingTime: number;
  currentLoad: number;
  lastActivity: Date;
}

interface TaskMetrics {
  totalCreated: number;
  totalCompleted: number;
  totalFailed: number;
  averageWaitTime: number;
  averageExecutionTime: number;
  queueDepth: Record<string, number>;
}

interface InfrastructureMetrics {
  cpuUsage: number;
  memoryUsage: number;
  redisConnections: number;
  activeWebsockets: number;
  apiRequestCount: number;
  apiErrorRate: number;
}

interface PerformanceMetrics {
  messageLatency: number;
  taskThroughput: number;
  systemResponseTime: number;
  concurrentAgents: number;
}

@Injectable()
export class MetricsService implements OnModuleInit {
  private metrics: Map<string, MetricPoint[]> = new Map();
  private metricDefinitions: Map<string, MetricDefinition> = new Map();
  private systemMetrics: SystemMetrics;
  private readonly maxDataPoints = 1000;
  private metricsBuffer: MetricPoint[] = [];
  private _flushInterval: NodeJS.Timeout | null = null;

  constructor(private readonly eventEmitter: EventEmitter2) {
    this.systemMetrics = this.initializeSystemMetrics();
    this.registerMetricDefinitions();
  }

  onModuleInit() {
    try {
      this.startMetricsCollection();
      // Temporarily disable event listeners to allow app to start
      // this.setupEventListeners();
    } catch (error) {
      console.error('Failed to initialize MetricsService:', error);
    }
  }

  recordMetric(
    name: string,
    value: number,
    labels?: Record<string, string>,
  ): void {
    const point: MetricPoint = {
      timestamp: new Date(),
      value,
      labels,
    };

    this.metricsBuffer.push(point);
    
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metricData = this.metrics.get(name)!;
    metricData.push(point);

    if (metricData.length > this.maxDataPoints) {
      metricData.shift();
    }
  }

  incrementCounter(name: string, labels?: Record<string, string>): void {
    const currentValue = this.getCurrentValue(name, labels) || 0;
    this.recordMetric(name, currentValue + 1, labels);
  }

  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    this.recordMetric(name, value, labels);
  }

  recordHistogram(
    name: string,
    value: number,
    labels?: Record<string, string>,
  ): void {
    this.recordMetric(name, value, labels);
  }

  getMetrics(name?: string, since?: Date): MetricPoint[] {
    if (!name) {
      const allMetrics: MetricPoint[] = [];
      for (const [_, points] of this.metrics) {
        allMetrics.push(...points);
      }
      return since
        ? allMetrics.filter(p => p.timestamp > since)
        : allMetrics;
    }

    const metricData = this.metrics.get(name) || [];
    return since
      ? metricData.filter(p => p.timestamp > since)
      : metricData;
  }

  getSystemMetrics(): SystemMetrics {
    return { ...this.systemMetrics };
  }

  getAgentMetrics(persona?: AgentPersona): AgentMetrics | Map<AgentPersona, AgentMetrics> {
    if (persona) {
      return this.systemMetrics.agentMetrics.get(persona) || this.createDefaultAgentMetrics();
    }
    return new Map(this.systemMetrics.agentMetrics);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async collectSystemMetrics(): Promise<void> {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    this.setGauge('system.memory.heap_used', memoryUsage.heapUsed);
    this.setGauge('system.memory.heap_total', memoryUsage.heapTotal);
    this.setGauge('system.cpu.user', cpuUsage.user);
    this.setGauge('system.cpu.system', cpuUsage.system);
    
    this.systemMetrics.systemMetrics = {
      cpuUsage: cpuUsage.user + cpuUsage.system,
      memoryUsage: memoryUsage.heapUsed,
      redisConnections: await this.getRedisConnectionCount(),
      activeWebsockets: this.getActiveWebsocketCount(),
      apiRequestCount: this.getApiRequestCount(),
      apiErrorRate: this.calculateApiErrorRate(),
    };
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async generateMetricsReport(): Promise<void> {
    const report = {
      timestamp: new Date(),
      system: this.systemMetrics,
      summary: this.generateSummary(),
      alerts: this.checkAlerts(),
    };

    this.eventEmitter.emit('metrics:report:generated', report);
  }

  @OnEvent('agent:task:completed')
  handleTaskCompleted(event: any): void {
    const { agent, duration } = event;
    const agentMetrics = this.getOrCreateAgentMetrics(agent);
    
    agentMetrics.tasksProcessed++;
    agentMetrics.tasksSucceeded++;
    agentMetrics.averageProcessingTime = this.updateAverage(
      agentMetrics.averageProcessingTime,
      duration,
      agentMetrics.tasksProcessed,
    );
    
    this.incrementCounter('agent.tasks.completed', { agent });
    this.recordHistogram('agent.task.duration', duration, { agent });
  }

  @OnEvent('agent:task:failed')
  handleTaskFailed(event: any): void {
    const { agent } = event;
    const agentMetrics = this.getOrCreateAgentMetrics(agent);
    
    agentMetrics.tasksProcessed++;
    agentMetrics.tasksFailed++;
    
    this.incrementCounter('agent.tasks.failed', { agent });
  }

  @OnEvent('message:published')
  handleMessagePublished(event: any): void {
    this.incrementCounter('messages.published');
    this.recordHistogram('message.size', JSON.stringify(event.message).length);
  }

  @OnEvent('api:request')
  handleApiRequest(event: any): void {
    const { method, path, duration, status } = event;
    
    this.incrementCounter('api.requests', { method, path });
    this.recordHistogram('api.request.duration', duration, { method, path });
    
    if (status >= 400) {
      this.incrementCounter('api.errors', { method, path, status: status.toString() });
    }
  }

  private registerMetricDefinitions(): void {
    const definitions: MetricDefinition[] = [
      {
        name: 'agent.tasks.completed',
        type: 'counter',
        description: 'Total number of tasks completed by agents',
        labels: ['agent'],
      },
      {
        name: 'agent.tasks.failed',
        type: 'counter',
        description: 'Total number of tasks failed by agents',
        labels: ['agent'],
      },
      {
        name: 'agent.task.duration',
        type: 'histogram',
        description: 'Task execution duration in milliseconds',
        labels: ['agent'],
      },
      {
        name: 'system.memory.heap_used',
        type: 'gauge',
        description: 'Heap memory used in bytes',
      },
      {
        name: 'api.requests',
        type: 'counter',
        description: 'Total API requests',
        labels: ['method', 'path'],
      },
      {
        name: 'messages.published',
        type: 'counter',
        description: 'Total messages published to message bus',
      },
    ];

    definitions.forEach(def => {
      this.metricDefinitions.set(def.name, def);
    });
  }

  private initializeSystemMetrics(): SystemMetrics {
    const agentMetrics = new Map<AgentPersona, AgentMetrics>();
    const personas: AgentPersona[] = [
      'tech_lead',
      'product_engineer',
      'qa_engineer',
      'devops_specialist',
      'doc_specialist',
      'code_reviewer',
    ];

    personas.forEach(persona => {
      agentMetrics.set(persona, this.createDefaultAgentMetrics());
    });

    return {
      agentMetrics,
      taskMetrics: {
        totalCreated: 0,
        totalCompleted: 0,
        totalFailed: 0,
        averageWaitTime: 0,
        averageExecutionTime: 0,
        queueDepth: {},
      },
      systemMetrics: {
        cpuUsage: 0,
        memoryUsage: 0,
        redisConnections: 0,
        activeWebsockets: 0,
        apiRequestCount: 0,
        apiErrorRate: 0,
      },
      performanceMetrics: {
        messageLatency: 0,
        taskThroughput: 0,
        systemResponseTime: 0,
        concurrentAgents: 0,
      },
    };
  }

  private createDefaultAgentMetrics(): AgentMetrics {
    return {
      tasksProcessed: 0,
      tasksSucceeded: 0,
      tasksFailed: 0,
      averageProcessingTime: 0,
      currentLoad: 0,
      lastActivity: new Date(),
    };
  }

  private getOrCreateAgentMetrics(persona: AgentPersona): AgentMetrics {
    if (!this.systemMetrics.agentMetrics.has(persona)) {
      this.systemMetrics.agentMetrics.set(persona, this.createDefaultAgentMetrics());
    }
    return this.systemMetrics.agentMetrics.get(persona)!;
  }

  private getCurrentValue(name: string, labels?: Record<string, string>): number | null {
    const metricData = this.metrics.get(name);
    if (!metricData || metricData.length === 0) return null;

    if (!labels) {
      return metricData[metricData.length - 1].value;
    }

    const filtered = metricData.filter(point => {
      if (!point.labels) return false;
      return Object.entries(labels).every(([k, v]) => point.labels![k] === v);
    });

    return filtered.length > 0 ? filtered[filtered.length - 1].value : null;
  }

  private updateAverage(
    currentAvg: number,
    newValue: number,
    count: number,
  ): number {
    return ((currentAvg * (count - 1)) + newValue) / count;
  }

  private startMetricsCollection(): void {
    this._flushInterval = setInterval(() => {
      this.flushMetrics();
    }, 10000);
  }

  onModuleDestroy() {
    if (this._flushInterval) {
      clearInterval(this._flushInterval);
    }
  }

  private flushMetrics(): void {
    if (this.metricsBuffer.length > 0) {
      console.log(`Flushing ${this.metricsBuffer.length} metrics`);
      this.metricsBuffer = [];
    }
  }

  private setupEventListeners(): void {
    this.eventEmitter.on('*', (event: any) => {
      this.incrementCounter('events.total', { event: event.type });
    });
  }

  private async getRedisConnectionCount(): Promise<number> {
    return 1;
  }

  private getActiveWebsocketCount(): number {
    return 0;
  }

  private getApiRequestCount(): number {
    return this.getCurrentValue('api.requests') || 0;
  }

  private calculateApiErrorRate(): number {
    const totalRequests = this.getApiRequestCount();
    const totalErrors = this.getCurrentValue('api.errors') || 0;
    
    return totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;
  }

  private generateSummary(): any {
    return {
      totalAgents: this.systemMetrics.agentMetrics.size,
      activeAgents: Array.from(this.systemMetrics.agentMetrics.values())
        .filter(m => m.currentLoad > 0).length,
      taskSuccessRate: this.calculateTaskSuccessRate(),
      systemHealth: this.calculateSystemHealth(),
    };
  }

  private calculateTaskSuccessRate(): number {
    const { totalCompleted, totalFailed } = this.systemMetrics.taskMetrics;
    const total = totalCompleted + totalFailed;
    
    return total > 0 ? (totalCompleted / total) * 100 : 100;
  }

  private calculateSystemHealth(): string {
    const errorRate = this.calculateApiErrorRate();
    const successRate = this.calculateTaskSuccessRate();
    
    if (errorRate > 10 || successRate < 80) return 'critical';
    if (errorRate > 5 || successRate < 90) return 'degraded';
    return 'healthy';
  }

  private checkAlerts(): string[] {
    const alerts: string[] = [];
    
    if (this.calculateApiErrorRate() > 5) {
      alerts.push('High API error rate detected');
    }
    
    if (this.calculateTaskSuccessRate() < 90) {
      alerts.push('Low task success rate');
    }
    
    const memoryUsage = process.memoryUsage();
    if (memoryUsage.heapUsed / memoryUsage.heapTotal > 0.9) {
      alerts.push('High memory usage detected');
    }
    
    return alerts;
  }
}