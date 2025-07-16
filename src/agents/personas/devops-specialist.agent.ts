import { Injectable } from '@nestjs/common';
import { BaseAgent } from '@core/agents/base-agent';
import type {
  AgentCapabilities,
  AgentConfig,
  Task,
} from '@interfaces/agent.interface';

interface DeploymentResult {
  status: 'success' | 'failed' | 'rollback';
  environment: string;
  version: string;
  duration: number;
  healthChecks: Record<string, boolean>;
}

@Injectable()
export class DevOpsSpecialistAgent extends BaseAgent {
  constructor() {
    const config: AgentConfig = {
      persona: 'devops_specialist',
      traits: {
        automation_focus: 0.95,
        security_mindset: 0.9,
        efficiency: 0.9,
        reliability_focus: 0.95,
        monitoring_obsession: 0.85,
      },
      responsibilities: [
        'CI/CD pipeline design',
        'Infrastructure as Code',
        'Container orchestration',
        'Monitoring and alerting',
        'Security compliance',
        'Performance optimization',
      ],
      communicationStyle: {
        tone: 'technical_precise',
        verbosity: 'concise',
        technicalLevel: 'very_high',
      },
    };
    super(config);
  }

  defineCapabilities(): AgentCapabilities {
    return {
      languages: ['bash', 'python', 'go', 'yaml'],
      frameworks: ['kubernetes', 'docker', 'terraform', 'ansible', 'helm'],
      specialties: ['ci/cd', 'infrastructure', 'monitoring', 'security'],
    };
  }

  protected async performTask(task: Task): Promise<any> {
    console.log(`DevOps Specialist ${this.id} handling: ${task.title}`);
    
    const taskCategory = this.categorizeDevOpsTask(task);
    
    switch (taskCategory) {
      case 'deployment':
        return this.performDeployment(task);
      case 'infrastructure':
        return this.manageInfrastructure(task);
      case 'pipeline':
        return this.configurePipeline(task);
      case 'monitoring':
        return this.setupMonitoring(task);
      case 'security':
        return this.performSecurityAudit(task);
      default:
        return this.performGeneralDevOps(task);
    }
  }

  protected async validateTask(task: Task): Promise<void> {
    if (!task.title || !task.description) {
      throw new Error('Task must have title and description');
    }
    
    if (this.isHighRiskOperation(task)) {
      this.emit('approval:required', {
        task,
        riskLevel: 'high',
        reason: 'Production environment modification',
      });
    }
  }

  protected async loadMemory(): Promise<void> {
    console.log('Loading DevOps configurations and deployment history');
  }

  protected async saveMemory(): Promise<void> {
    console.log('Saving DevOps metrics and configuration state');
  }

  protected async setupTools(): Promise<void> {
    console.log('Initializing DevOps toolchain and cloud connections');
  }

  private categorizeDevOpsTask(task: Task): string {
    const description = task.description.toLowerCase();
    
    if (description.includes('deploy') || description.includes('release')) {
      return 'deployment';
    } else if (description.includes('infrastructure') || description.includes('terraform')) {
      return 'infrastructure';
    } else if (description.includes('pipeline') || description.includes('ci/cd')) {
      return 'pipeline';
    } else if (description.includes('monitor') || description.includes('alert')) {
      return 'monitoring';
    } else if (description.includes('security') || description.includes('compliance')) {
      return 'security';
    }
    
    return 'general';
  }

  private async performDeployment(_task: Task): Promise<DeploymentResult> {
    const result: DeploymentResult = {
      status: 'success',
      environment: 'production',
      version: '2.3.1',
      duration: 480,
      healthChecks: {
        api: true,
        database: true,
        cache: true,
        queue: true,
      },
    };
    
    await this.verifyDeployment(result);
    return result;
  }

  private async manageInfrastructure(_task: Task): Promise<any> {
    return {
      action: 'infrastructure_update',
      provider: 'AWS',
      resources: {
        created: [
          'eks-cluster-prod',
          'rds-postgres-primary',
          'elasticache-redis',
        ],
        modified: [
          'alb-ingress-controller',
          'security-group-api',
        ],
        destroyed: [],
      },
      terraformPlan: {
        additions: 3,
        changes: 2,
        destructions: 0,
      },
      estimatedCost: '$450/month',
      applied: true,
    };
  }

  private async configurePipeline(_task: Task): Promise<any> {
    return {
      pipeline: 'github-actions',
      stages: [
        {
          name: 'build',
          steps: ['checkout', 'setup-node', 'install', 'build'],
          duration: '2m',
        },
        {
          name: 'test',
          steps: ['unit-tests', 'integration-tests', 'coverage'],
          duration: '5m',
        },
        {
          name: 'security',
          steps: ['sast-scan', 'dependency-check', 'container-scan'],
          duration: '3m',
        },
        {
          name: 'deploy',
          steps: ['build-image', 'push-registry', 'deploy-k8s'],
          duration: '4m',
        },
      ],
      triggers: ['push to main', 'pull request', 'schedule'],
      notifications: ['slack', 'email'],
      status: 'configured',
    };
  }

  private async setupMonitoring(_task: Task): Promise<any> {
    return {
      monitoringStack: {
        metrics: 'Prometheus',
        logs: 'Loki',
        traces: 'Jaeger',
        visualization: 'Grafana',
      },
      dashboards: [
        'System Overview',
        'Application Performance',
        'Business Metrics',
        'Error Tracking',
      ],
      alerts: [
        {
          name: 'High Error Rate',
          condition: 'error_rate > 5%',
          severity: 'critical',
          channels: ['pagerduty', 'slack'],
        },
        {
          name: 'Low Disk Space',
          condition: 'disk_usage > 85%',
          severity: 'warning',
          channels: ['slack'],
        },
        {
          name: 'API Latency',
          condition: 'p95_latency > 500ms',
          severity: 'warning',
          channels: ['slack'],
        },
      ],
      slos: {
        availability: '99.9%',
        latency_p95: '200ms',
        error_rate: '< 0.1%',
      },
    };
  }

  private async performSecurityAudit(_task: Task): Promise<any> {
    return {
      scanResults: {
        infrastructure: {
          findings: 3,
          critical: 0,
          high: 1,
          medium: 2,
        },
        containers: {
          vulnerabilities: 12,
          critical: 0,
          high: 2,
          medium: 5,
          low: 5,
        },
        secrets: {
          exposed: 0,
          weak: 2,
          rotation_needed: 5,
        },
      },
      compliance: {
        cis_benchmark: '85%',
        pci_dss: 'N/A',
        hipaa: 'N/A',
        soc2: 'In Progress',
      },
      recommendations: [
        'Update base images to latest patches',
        'Rotate API keys older than 90 days',
        'Enable network policies in Kubernetes',
        'Implement pod security policies',
      ],
    };
  }

  private async performGeneralDevOps(_task: Task): Promise<any> {
    return {
      status: 'completed',
      action: 'General DevOps task',
      details: 'Task completed successfully',
      metrics: {
        duration: '15m',
        resources_used: 'minimal',
      },
    };
  }

  private isHighRiskOperation(task: Task): boolean {
    const highRiskKeywords = [
      'production',
      'delete',
      'destroy',
      'database',
      'security',
      'credential',
    ];
    
    return highRiskKeywords.some(keyword =>
      task.description.toLowerCase().includes(keyword),
    );
  }

  private async verifyDeployment(result: DeploymentResult): Promise<void> {
    const allHealthy = Object.values(result.healthChecks).every(check => check);
    
    if (!allHealthy) {
      this.emit('deployment:unhealthy', {
        result,
        failedChecks: Object.entries(result.healthChecks)
          .filter(([_, status]) => !status)
          .map(([service]) => service),
      });
    }
  }
}