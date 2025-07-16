import type { AgentMessage, AgentPersona, AgentStatus, Task } from './agent.interface';

export type DevelopmentPhase = 
  | 'planning' 
  | 'scaffold' 
  | 'feature' 
  | 'test' 
  | 'review' 
  | 'deploy';

export interface PhaseTransition {
  fromPhase: DevelopmentPhase;
  toPhase: DevelopmentPhase;
  conditions: string[];
  requiredApprovals?: AgentPersona[];
}

export interface PhaseConfig {
  phase: DevelopmentPhase;
  activeAgents: AgentPersona[];
  duration?: string;
  exitCriteria: string[];
  deliverables: string[];
}

export interface IOrchestratorService {
  currentPhase: DevelopmentPhase;
  activeAgents: Map<AgentPersona, AgentStatus>;
  taskQueue: Task[];
  messagebus: AgentMessage[];

  initializePhase(phase: DevelopmentPhase): Promise<void>;
  transitionPhase(toPhase: DevelopmentPhase): Promise<boolean>;
  assignTask(task: Task): Promise<AgentPersona>;
  routeMessage(message: AgentMessage): Promise<void>;
  getSystemStatus(): SystemStatus;
  resolveConflict(agents: AgentPersona[], context: any): Promise<any>;
}

export interface SystemStatus {
  phase: DevelopmentPhase;
  activeAgentCount: number;
  taskQueueLength: number;
  completedTasks: number;
  systemHealth: 'healthy' | 'degraded' | 'critical';
  uptime: number;
  lastPhaseTransition: Date;
}

export interface TaskDistributionStrategy {
  type: 'round-robin' | 'load-balanced' | 'skill-based' | 'priority-based';
  considerAvailability: boolean;
  considerExpertise: boolean;
  considerWorkload: boolean;
}

export interface ConflictResolutionStrategy {
  type: 'voting' | 'seniority' | 'consensus' | 'human-override';
  timeout: number;
  escalationPath: AgentPersona[];
}