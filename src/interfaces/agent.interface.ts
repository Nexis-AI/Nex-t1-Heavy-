export type AgentPersona = 
  | 'tech_lead' 
  | 'product_engineer' 
  | 'qa_engineer' 
  | 'devops_specialist' 
  | 'doc_specialist' 
  | 'code_reviewer';

export type MessageType = 'TASK' | 'QUERY' | 'RESPONSE' | 'CRITIQUE';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AgentState = 'idle' | 'working' | 'blocked' | 'reviewing' | 'completed' | 'paused';

export interface AgentTraits {
  [key: string]: number;
}

export interface AgentMessage {
  id: string;
  fromAgent: AgentPersona;
  toAgent: AgentPersona | AgentPersona[];
  messageType: MessageType;
  payload: any;
  priority: Priority;
  timestamp: Date;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assignedTo: AgentPersona;
  status: 'pending' | 'in_progress' | 'blocked' | 'review' | 'completed';
  priority: Priority;
  createdAt: Date;
  updatedAt: Date;
  dependencies?: string[];
  artifacts?: string[];
}

export interface AgentCapabilities {
  languages: string[];
  frameworks: string[];
  specialties: string[];
}

export interface AgentMetrics {
  tasksCompleted: number;
  tasksInProgress: number;
  averageCompletionTime: number;
  qualityScore: number;
  collaborationScore: number;
}

export interface IAgent {
  id: string;
  persona: AgentPersona;
  state: AgentState;
  traits: AgentTraits;
  capabilities: AgentCapabilities;
  currentTasks: Task[];
  metrics: AgentMetrics;

  initialize(): Promise<void>;
  processMessage(message: AgentMessage): Promise<void>;
  executeTask(task: Task): Promise<void>;
  collaborate(withAgent: AgentPersona, context: any): Promise<void>;
  reportStatus(): AgentStatus;
  shutdown(): Promise<void>;
}

export interface AgentStatus {
  agentId: string;
  persona: AgentPersona;
  state: AgentState;
  currentLoad: number;
  availability: boolean;
  lastActivity: Date;
  activeTaskCount: number;
}

export interface AgentConfig {
  persona: AgentPersona;
  traits: AgentTraits;
  responsibilities: string[];
  decisionAuthority?: string[];
  communicationStyle: {
    tone: string;
    verbosity: string;
    technicalLevel: string;
  };
}

export interface WorkloadLimits {
  maxConcurrentTasks: number;
  maxStoryPoints: number;
  focusTimeBlocks: string;
}

export interface AgentWorkload {
  [persona: string]: WorkloadLimits;
}