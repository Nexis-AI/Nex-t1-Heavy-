import { Injectable } from '@nestjs/common';
import { BaseAgent } from '@core/agents/base-agent';
import type {
  AgentCapabilities,
  AgentConfig,
  Task,
} from '@interfaces/agent.interface';

@Injectable()
export class TechLeadAgent extends BaseAgent {
  constructor() {
    const config: AgentConfig = {
      persona: 'tech_lead',
      traits: {
        leadership: 0.9,
        technical_depth: 0.85,
        strategic_thinking: 0.95,
        decision_making: 0.9,
        conflict_resolution: 0.85,
      },
      responsibilities: [
        'System architecture design',
        'Technical strategy formulation',
        'Cross-team coordination',
        'Conflict resolution',
        'Performance optimization strategy',
        'Technology selection',
      ],
      decisionAuthority: [
        'Architecture patterns',
        'Technology stack changes',
        'Breaking changes approval',
        'Resource allocation',
      ],
      communicationStyle: {
        tone: 'authoritative_yet_collaborative',
        verbosity: 'concise',
        technicalLevel: 'high',
      },
    };
    super(config);
  }

  defineCapabilities(): AgentCapabilities {
    return {
      languages: ['typescript', 'javascript', 'python', 'go'],
      frameworks: ['nestjs', 'react', 'express', 'django'],
      specialties: ['architecture', 'scalability', 'security'],
    };
  }

  protected async performTask(task: Task): Promise<any> {
    console.log(`Tech Lead ${this.id} performing task: ${task.title}`);
    
    switch (task.description) {
      case 'architecture_review':
        return this.performArchitectureReview(task);
      case 'conflict_resolution':
        return this.resolveConflict(task);
      case 'technology_decision':
        return this.makeTechnologyDecision(task);
      default:
        return this.performGenericTask(task);
    }
  }

  protected async validateTask(task: Task): Promise<void> {
    if (!task.title || !task.description) {
      throw new Error('Task must have title and description');
    }
    
    const hasAuthority = this.checkDecisionAuthority(task);
    if (!hasAuthority) {
      throw new Error('Tech Lead does not have authority for this task type');
    }
  }

  protected async loadMemory(): Promise<void> {
    console.log('Loading Tech Lead memory and context');
  }

  protected async saveMemory(): Promise<void> {
    console.log('Saving Tech Lead memory and context');
  }

  protected async setupTools(): Promise<void> {
    console.log('Setting up Tech Lead tools and integrations');
  }

  private async performArchitectureReview(_task: Task): Promise<any> {
    return {
      review: 'Architecture review completed',
      recommendations: [
        'Consider microservices pattern',
        'Implement caching layer',
        'Add monitoring',
      ],
      approvalStatus: 'approved_with_conditions',
    };
  }

  private async resolveConflict(_task: Task): Promise<any> {
    return {
      resolution: 'Conflict resolved through technical analysis',
      decision: 'Proceed with option A',
      rationale: 'Better scalability and maintainability',
    };
  }

  private async makeTechnologyDecision(_task: Task): Promise<any> {
    return {
      decision: 'Selected technology stack',
      technologies: ['NestJS', 'PostgreSQL', 'Redis'],
      justification: 'Best fit for requirements and team expertise',
    };
  }

  private async performGenericTask(_task: Task): Promise<any> {
    return {
      status: 'completed',
      result: 'Generic task completed by Tech Lead',
    };
  }

  private checkDecisionAuthority(task: Task): boolean {
    const authorityKeywords = [
      'architecture',
      'technology',
      'breaking',
      'resource',
    ];
    
    return authorityKeywords.some(keyword =>
      task.description.toLowerCase().includes(keyword),
    );
  }
}