import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type {
  AgentMessage,
  AgentPersona,
  AgentStatus,
  Task,
} from '@interfaces/agent.interface';
import type {
  ConflictResolutionStrategy,
  DevelopmentPhase,
  IOrchestratorService,
  PhaseConfig,
  SystemStatus,
  TaskDistributionStrategy,
} from '@interfaces/orchestrator.interface';
import { BaseAgent } from '@core/agents/base-agent';

@Injectable()
export class OrchestratorService implements IOrchestratorService, OnModuleInit {
  currentPhase: DevelopmentPhase = 'planning';
  activeAgents: Map<AgentPersona, AgentStatus> = new Map();
  taskQueue: Task[] = [];
  messagebus: AgentMessage[] = [];

  private agents: Map<AgentPersona, BaseAgent> = new Map();
  private phaseConfigs: Map<DevelopmentPhase, PhaseConfig> = new Map();
  private taskDistributionStrategy: TaskDistributionStrategy;
  private conflictResolutionStrategy: ConflictResolutionStrategy;
  private systemStartTime: Date = new Date();
  private completedTaskCount: number = 0;

  constructor(
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.initializePhaseConfigs();
    this.setupTaskDistributionStrategy();
    this.setupConflictResolutionStrategy();
  }

  onModuleInit() {
    // Temporarily disable event listeners to allow app to start
    // this.setupEventListeners();
  }

  async initializePhase(phase: DevelopmentPhase): Promise<void> {
    this.currentPhase = phase;
    const phaseConfig = this.phaseConfigs.get(phase);
    
    if (!phaseConfig) {
      throw new Error(`Phase configuration not found for: ${phase}`);
    }

    await this.deactivateCurrentAgents();
    await this.activatePhaseAgents(phaseConfig.activeAgents);
    
    this.eventEmitter.emit('phase:initialized', {
      phase,
      activeAgents: phaseConfig.activeAgents,
      timestamp: new Date(),
    });
  }

  async transitionPhase(_toPhase: DevelopmentPhase): Promise<boolean> {
    const currentConfig = this.phaseConfigs.get(this.currentPhase);
    const targetConfig = this.phaseConfigs.get(_toPhase);

    if (!currentConfig || !targetConfig) {
      return false;
    }

    const canTransition = await this.validatePhaseTransition(
      this.currentPhase,
      _toPhase,
    );

    if (!canTransition) {
      return false;
    }

    await this.completeCurrentPhase();
    await this.initializePhase(_toPhase);

    this.eventEmitter.emit('phase:transitioned', {
      fromPhase: this.currentPhase,
      toPhase: _toPhase,
      timestamp: new Date(),
    });

    return true;
  }

  async assignTask(task: Task): Promise<AgentPersona> {
    const availableAgents = await this.getAvailableAgents();
    const assignedAgent = await this.selectBestAgent(task, availableAgents);

    if (!assignedAgent) {
      throw new Error('No available agent for task assignment');
    }

    task.assignedTo = assignedAgent;
    await this.dispatchTaskToAgent(task, assignedAgent);

    this.eventEmitter.emit('task:assigned', {
      task,
      agent: assignedAgent,
      timestamp: new Date(),
    });

    return assignedAgent;
  }

  async routeMessage(message: AgentMessage): Promise<void> {
    this.messagebus.push(message);

    const targetAgents = Array.isArray(message.toAgent)
      ? message.toAgent
      : [message.toAgent];

    for (const targetAgent of targetAgents) {
      const agent = this.agents.get(targetAgent);
      if (agent) {
        await agent.processMessage(message);
      }
    }

    this.eventEmitter.emit('message:routed', {
      message,
      timestamp: new Date(),
    });
  }

  getSystemStatus(): SystemStatus {
    const activeAgentCount = Array.from(this.activeAgents.values()).filter(
      (status) => status.availability,
    ).length;

    const systemHealth = this.calculateSystemHealth();
    const uptime = Date.now() - this.systemStartTime.getTime();

    return {
      phase: this.currentPhase,
      activeAgentCount,
      taskQueueLength: this.taskQueue.length,
      completedTasks: this.completedTaskCount,
      systemHealth,
      uptime,
      lastPhaseTransition: new Date(),
    };
  }

  async resolveConflict(agents: AgentPersona[], context: any): Promise<any> {
    switch (this.conflictResolutionStrategy.type) {
      case 'voting':
        return await this.resolveByVoting(agents, context);
      case 'seniority':
        return await this.resolveBySeniority(agents, context);
      case 'consensus':
        return await this.resolveByConsensus(agents, context);
      case 'human-override':
        return await this.requestHumanIntervention(agents, context);
      default:
        throw new Error('Unknown conflict resolution strategy');
    }
  }

  async pauseAgent(persona: AgentPersona): Promise<void> {
    const agent = this.agents.get(persona);
    if (agent) {
      await agent.pause();
      this.updateAgentStatus(persona, agent.reportStatus());
    }
  }

  async resumeAgent(persona: AgentPersona): Promise<void> {
    const agent = this.agents.get(persona);
    if (agent) {
      await agent.resume();
      this.updateAgentStatus(persona, agent.reportStatus());
    }
  }

  private initializePhaseConfigs(): void {
    const phases: DevelopmentPhase[] = [
      'planning',
      'scaffold',
      'feature',
      'test',
      'review',
      'deploy',
    ];

    const phaseAgentMap: Record<DevelopmentPhase, AgentPersona[]> = {
      planning: ['tech_lead', 'product_engineer'],
      scaffold: ['tech_lead', 'devops_specialist'],
      feature: ['product_engineer', 'code_reviewer'],
      test: ['qa_engineer', 'product_engineer'],
      review: ['code_reviewer', 'tech_lead', 'qa_engineer'],
      deploy: ['devops_specialist', 'tech_lead'],
    };

    phases.forEach((phase) => {
      this.phaseConfigs.set(phase, {
        phase,
        activeAgents: phaseAgentMap[phase],
        exitCriteria: this.getPhaseExitCriteria(phase),
        deliverables: this.getPhaseDeliverables(phase),
      });
    });
  }

  private setupTaskDistributionStrategy(): void {
    this.taskDistributionStrategy = {
      type: 'skill-based',
      considerAvailability: true,
      considerExpertise: true,
      considerWorkload: true,
    };
  }

  private setupConflictResolutionStrategy(): void {
    this.conflictResolutionStrategy = {
      type: 'consensus',
      timeout: 300000, // 5 minutes
      escalationPath: ['tech_lead'],
    };
  }

  private setupEventListeners(): void {
    this.eventEmitter.on('agent:initialized', (data) => {
      this.updateAgentStatus(data.persona, data.status);
    });

    this.eventEmitter.on('task:completed', (data) => {
      this.completedTaskCount++;
      this.removeTaskFromQueue(data.task.id);
    });

    this.eventEmitter.on('agent:heartbeat', (data) => {
      this.updateAgentStatus(data.persona, data.status);
    });
  }

  private async deactivateCurrentAgents(): Promise<void> {
    for (const [persona, agent] of this.agents) {
      if (agent.state !== 'idle') {
        await this.gracefullyStopAgent(agent);
      }
      this.activeAgents.delete(persona);
    }
  }

  private async activatePhaseAgents(agents: AgentPersona[]): Promise<void> {
    for (const persona of agents) {
      const agent = await this.createOrGetAgent(persona);
      await agent.initialize();
      this.activeAgents.set(persona, agent.reportStatus());
    }
  }

  private async validatePhaseTransition(
    from: DevelopmentPhase,
    _to: DevelopmentPhase,
  ): Promise<boolean> {
    const currentConfig = this.phaseConfigs.get(from);
    if (!currentConfig) return false;

    for (const criterion of currentConfig.exitCriteria) {
      const met = await this.checkExitCriterion(criterion);
      if (!met) return false;
    }

    return true;
  }

  private async completeCurrentPhase(): Promise<void> {
    await this.waitForTaskCompletion();
    await this.generatePhaseReport();
    await this.archivePhaseData();
  }

  private async getAvailableAgents(): Promise<AgentPersona[]> {
    const available: AgentPersona[] = [];
    
    for (const [persona, status] of this.activeAgents) {
      if (status.availability && status.currentLoad < 0.8) {
        available.push(persona);
      }
    }
    
    return available;
  }

  private async selectBestAgent(
    task: Task,
    availableAgents: AgentPersona[],
  ): Promise<AgentPersona | null> {
    if (availableAgents.length === 0) return null;

    if (this.taskDistributionStrategy.type === 'skill-based') {
      return this.selectBySkills(task, availableAgents);
    }

    return availableAgents[0];
  }

  private async dispatchTaskToAgent(
    task: Task,
    agent: AgentPersona,
  ): Promise<void> {
    const agentInstance = this.agents.get(agent);
    if (agentInstance) {
      await agentInstance.executeTask(task);
    }
  }

  private calculateSystemHealth(): 'healthy' | 'degraded' | 'critical' {
    const activeRatio = this.activeAgents.size / this.agents.size;
    const queueLength = this.taskQueue.length;

    if (activeRatio < 0.5 || queueLength > 100) return 'critical';
    if (activeRatio < 0.8 || queueLength > 50) return 'degraded';
    return 'healthy';
  }

  private async resolveByVoting(
    agents: AgentPersona[],
    context: any,
  ): Promise<any> {
    const votes = new Map<string, number>();
    
    for (const agent of agents) {
      const vote = await this.requestAgentVote(agent, context);
      votes.set(vote, (votes.get(vote) || 0) + 1);
    }

    return Array.from(votes.entries()).reduce((a, b) =>
      a[1] > b[1] ? a : b,
    )[0];
  }

  private async resolveBySeniority(
    agents: AgentPersona[],
    context: any,
  ): Promise<any> {
    const seniorityOrder: AgentPersona[] = [
      'tech_lead',
      'product_engineer',
      'qa_engineer',
      'devops_specialist',
      'doc_specialist',
      'code_reviewer',
    ];

    for (const senior of seniorityOrder) {
      if (agents.includes(senior)) {
        return await this.requestAgentDecision(senior, context);
      }
    }

    return null;
  }

  private async resolveByConsensus(
    agents: AgentPersona[],
    context: any,
  ): Promise<any> {
    let consensus = null;
    let attempts = 0;
    const maxAttempts = 3;

    while (!consensus && attempts < maxAttempts) {
      const proposals = await Promise.all(
        agents.map((agent) => this.requestAgentProposal(agent, context)),
      );

      consensus = this.findConsensus(proposals);
      attempts++;
    }

    return consensus;
  }

  private async requestHumanIntervention(
    agents: AgentPersona[],
    context: any,
  ): Promise<any> {
    this.eventEmitter.emit('human:intervention:required', {
      agents,
      context,
      timestamp: new Date(),
    });

    return new Promise((resolve) => {
      this.eventEmitter.once('human:intervention:response', (response) => {
        resolve(response);
      });
    });
  }

  private getPhaseExitCriteria(phase: DevelopmentPhase): string[] {
    const criteriaMap: Record<DevelopmentPhase, string[]> = {
      planning: ['requirements_documented', 'architecture_defined'],
      scaffold: ['project_structure_created', 'ci_cd_configured'],
      feature: ['features_implemented', 'unit_tests_passing'],
      test: ['all_tests_passing', 'coverage_target_met'],
      review: ['code_review_approved', 'security_scan_passed'],
      deploy: ['deployment_successful', 'health_checks_passing'],
    };

    return criteriaMap[phase] || [];
  }

  private getPhaseDeliverables(phase: DevelopmentPhase): string[] {
    const deliverablesMap: Record<DevelopmentPhase, string[]> = {
      planning: ['requirements.md', 'architecture.md'],
      scaffold: ['package.json', 'tsconfig.json', '.github/workflows'],
      feature: ['src/', 'tests/'],
      test: ['test-report.html', 'coverage-report.html'],
      review: ['review-report.md', 'security-report.md'],
      deploy: ['deployment-manifest.yml', 'release-notes.md'],
    };

    return deliverablesMap[phase] || [];
  }

  private async createOrGetAgent(persona: AgentPersona): Promise<BaseAgent> {
    const existing = this.agents.get(persona);
    if (existing) return existing;

    throw new Error(`Agent implementation not found for persona: ${persona}`);
  }

  private async gracefullyStopAgent(agent: BaseAgent): Promise<void> {
    const timeout = 30000;
    const startTime = Date.now();

    while (agent.state !== 'idle' && Date.now() - startTime < timeout) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    await agent.shutdown();
  }

  private async checkExitCriterion(_criterion: string): Promise<boolean> {
    return true;
  }

  private async waitForTaskCompletion(): Promise<void> {
    while (this.taskQueue.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  private async generatePhaseReport(): Promise<void> {
    this.eventEmitter.emit('phase:report:generated', {
      phase: this.currentPhase,
      timestamp: new Date(),
    });
  }

  private async archivePhaseData(): Promise<void> {
    this.eventEmitter.emit('phase:data:archived', {
      phase: this.currentPhase,
      timestamp: new Date(),
    });
  }

  private updateAgentStatus(persona: AgentPersona, status: AgentStatus): void {
    this.activeAgents.set(persona, status);
  }

  private removeTaskFromQueue(taskId: string): void {
    this.taskQueue = this.taskQueue.filter((task) => task.id !== taskId);
  }

  private selectBySkills(
    _task: Task,
    availableAgents: AgentPersona[],
  ): AgentPersona {
    return availableAgents[0];
  }

  private async requestAgentVote(
    _agent: AgentPersona,
    _context: any,
  ): Promise<string> {
    return 'default';
  }

  private async requestAgentDecision(
    _agent: AgentPersona,
    context: any,
  ): Promise<any> {
    return context;
  }

  private async requestAgentProposal(
    _agent: AgentPersona,
    context: any,
  ): Promise<any> {
    return context;
  }

  private findConsensus(proposals: any[]): any | null {
    return proposals[0];
  }
}