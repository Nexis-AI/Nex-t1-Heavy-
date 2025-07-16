import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import type { AgentMessage, AgentPersona } from '@interfaces/agent.interface';

interface MessageHandler {
  id: string;
  pattern: string;
  handler: (message: AgentMessage) => Promise<void>;
}

interface MessageSubscription {
  agentId: string;
  patterns: string[];
  callback: (message: AgentMessage) => void;
}

@Injectable()
export class MessageBusService implements OnModuleInit, OnModuleDestroy {
  private publisher: Redis;
  private subscriber: Redis;
  private messageHandlers: Map<string, MessageHandler> = new Map();
  private subscriptions: Map<string, MessageSubscription> = new Map();
  private messageHistory: AgentMessage[] = [];
  private readonly maxHistorySize = 1000;

  constructor(private readonly eventEmitter: EventEmitter2) {
    this.publisher = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    });

    this.subscriber = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    });
  }

  async onModuleInit() {
    try {
      await this.setupRedisSubscriptions();
      // Temporarily disable event listeners to allow app to start
      // this.setupEventListeners();
    } catch (error) {
      console.error('Failed to initialize MessageBusService:', error);
    }
  }

  async onModuleDestroy() {
    await this.publisher.quit();
    await this.subscriber.quit();
  }

  async publish(message: AgentMessage): Promise<void> {
    const channel = this.getChannelName(message);
    const serializedMessage = JSON.stringify({
      ...message,
      timestamp: message.timestamp || new Date(),
      id: message.id || uuidv4(),
    });

    await this.publisher.publish(channel, serializedMessage);
    this.addToHistory(message);
    
    this.eventEmitter.emit('message:published', {
      message,
      channel,
      timestamp: new Date(),
    });
  }

  async broadcast(message: Omit<AgentMessage, 'toAgent'>): Promise<void> {
    const broadcastMessage: AgentMessage = {
      ...message,
      toAgent: 'all' as AgentPersona,
      id: uuidv4(),
      timestamp: new Date(),
    };

    await this.publisher.publish('agent:broadcast', JSON.stringify(broadcastMessage));
    this.addToHistory(broadcastMessage);
  }

  subscribe(
    agentId: string,
    patterns: string[],
    callback: (message: AgentMessage) => void,
  ): string {
    const subscriptionId = uuidv4();
    this.subscriptions.set(subscriptionId, {
      agentId,
      patterns,
      callback,
    });

    patterns.forEach((pattern) => {
      this.subscriber.psubscribe(pattern);
    });

    return subscriptionId;
  }

  unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      subscription.patterns.forEach((pattern) => {
        this.subscriber.punsubscribe(pattern);
      });
      this.subscriptions.delete(subscriptionId);
    }
  }

  registerHandler(
    pattern: string,
    handler: (message: AgentMessage) => Promise<void>,
  ): string {
    const handlerId = uuidv4();
    this.messageHandlers.set(handlerId, {
      id: handlerId,
      pattern,
      handler,
    });
    return handlerId;
  }

  unregisterHandler(handlerId: string): void {
    this.messageHandlers.delete(handlerId);
  }

  async getMessageHistory(
    filter?: {
      fromAgent?: AgentPersona;
      toAgent?: AgentPersona;
      messageType?: AgentMessage['messageType'];
      since?: Date;
    },
  ): Promise<AgentMessage[]> {
    let history = [...this.messageHistory];

    if (filter) {
      if (filter.fromAgent) {
        history = history.filter((msg) => msg.fromAgent === filter.fromAgent);
      }
      if (filter.toAgent) {
        history = history.filter((msg) => {
          if (Array.isArray(msg.toAgent)) {
            return msg.toAgent.includes(filter.toAgent!);
          }
          return msg.toAgent === filter.toAgent;
        });
      }
      if (filter.messageType) {
        history = history.filter((msg) => msg.messageType === filter.messageType);
      }
      if (filter.since) {
        history = history.filter((msg) => msg.timestamp > filter.since!);
      }
    }

    return history;
  }

  async sendDirectMessage(
    fromAgent: AgentPersona,
    toAgent: AgentPersona,
    payload: any,
    priority: AgentMessage['priority'] = 'MEDIUM',
  ): Promise<void> {
    const message: AgentMessage = {
      id: uuidv4(),
      fromAgent,
      toAgent,
      messageType: 'TASK',
      payload,
      priority,
      timestamp: new Date(),
    };

    await this.publish(message);
  }

  async requestResponse(
    fromAgent: AgentPersona,
    toAgent: AgentPersona,
    query: any,
    timeout: number = 30000,
  ): Promise<any> {
    const requestId = uuidv4();
    const responseChannel = `response:${requestId}`;

    const responsePromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.subscriber.unsubscribe(responseChannel);
        reject(new Error(`Request timeout after ${timeout}ms`));
      }, timeout);

      this.subscriber.subscribe(responseChannel, (err) => {
        if (err) {
          clearTimeout(timer);
          reject(err);
        }
      });

      this.subscriber.on('message', (channel, message) => {
        if (channel === responseChannel) {
          clearTimeout(timer);
          this.subscriber.unsubscribe(responseChannel);
          resolve(JSON.parse(message));
        }
      });
    });

    const queryMessage: AgentMessage = {
      id: requestId,
      fromAgent,
      toAgent,
      messageType: 'QUERY',
      payload: { query, responseChannel },
      priority: 'HIGH',
      timestamp: new Date(),
    };

    await this.publish(queryMessage);
    return responsePromise;
  }

  private async setupRedisSubscriptions(): Promise<void> {
    this.subscriber.on('pmessage', async (pattern, _channel, message) => {
      try {
        const parsedMessage: AgentMessage = JSON.parse(message);
        await this.handleIncomingMessage(parsedMessage, pattern);
      } catch (error) {
        console.error('Error processing message:', error);
      }
    });

    await this.subscriber.psubscribe('agent:*');
  }

  private setupEventListeners(): void {
    this.eventEmitter.on('agent:message:send', async (data) => {
      await this.publish(data.message);
    });

    this.eventEmitter.on('agent:broadcast', async (data) => {
      await this.broadcast(data.message);
    });
  }

  private async handleIncomingMessage(
    message: AgentMessage,
    pattern: string,
  ): Promise<void> {
    for (const [, handler] of this.messageHandlers) {
      if (this.matchPattern(pattern, handler.pattern)) {
        try {
          await handler.handler(message);
        } catch (error) {
          console.error(`Handler error for pattern ${handler.pattern}:`, error);
        }
      }
    }

    for (const [, subscription] of this.subscriptions) {
      if (subscription.patterns.some((p) => this.matchPattern(pattern, p))) {
        subscription.callback(message);
      }
    }

    this.eventEmitter.emit('message:received', {
      message,
      pattern,
      timestamp: new Date(),
    });
  }

  private getChannelName(message: AgentMessage): string {
    if (Array.isArray(message.toAgent)) {
      return 'agent:multicast';
    }
    return `agent:${message.toAgent}`;
  }

  private addToHistory(message: AgentMessage): void {
    this.messageHistory.push(message);
    if (this.messageHistory.length > this.maxHistorySize) {
      this.messageHistory.shift();
    }
  }

  private matchPattern(channel: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/\*/g, '[^:]*')
      .replace(/\?/g, '.');
    return new RegExp(`^${regexPattern}$`).test(channel);
  }

  async getQueueDepth(agentId: AgentPersona): Promise<number> {
    const messages = await this.getMessageHistory({
      toAgent: agentId,
      since: new Date(Date.now() - 60000),
    });
    return messages.length;
  }

  async purgeOldMessages(olderThan: Date): Promise<number> {
    const initialLength = this.messageHistory.length;
    this.messageHistory = this.messageHistory.filter(
      (msg) => msg.timestamp > olderThan,
    );
    return initialLength - this.messageHistory.length;
  }

  getActiveSubscriptions(): Map<string, MessageSubscription> {
    return new Map(this.subscriptions);
  }

  async healthCheck(): Promise<{
    connected: boolean;
    subscriptions: number;
    handlers: number;
    queuedMessages: number;
  }> {
    const connected = this.publisher.status === 'ready' && this.subscriber.status === 'ready';
    
    return {
      connected,
      subscriptions: this.subscriptions.size,
      handlers: this.messageHandlers.size,
      queuedMessages: this.messageHistory.length,
    };
  }
}