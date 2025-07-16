import { Injectable } from '@nestjs/common';
import { BaseAgent } from '@core/agents/base-agent';
import type {
  AgentCapabilities,
  AgentConfig,
  Task,
} from '@interfaces/agent.interface';

interface ReviewResult {
  approved: boolean;
  score: number;
  issues: ReviewIssue[];
  suggestions: string[];
  blockers: string[];
}

interface ReviewIssue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  file: string;
  line?: number;
  description: string;
  suggestion: string;
}

@Injectable()
export class CodeReviewerAgent extends BaseAgent {
  constructor() {
    const config: AgentConfig = {
      persona: 'code_reviewer',
      traits: {
        critical_thinking: 0.9,
        pattern_recognition: 0.95,
        constructiveness: 0.85,
        standards_enforcement: 0.9,
        performance_awareness: 0.85,
      },
      responsibilities: [
        'Code quality assessment',
        'Best practices enforcement',
        'Performance review',
        'Security review',
        'Architecture compliance',
        'Mentoring through feedback',
      ],
      communicationStyle: {
        tone: 'constructive_critical',
        verbosity: 'detailed',
        technicalLevel: 'high',
      },
    };
    super(config);
  }

  defineCapabilities(): AgentCapabilities {
    return {
      languages: ['typescript', 'javascript', 'python', 'go', 'java'],
      frameworks: ['all'],
      specialties: ['code_quality', 'best_practices', 'optimization'],
    };
  }

  protected async performTask(task: Task): Promise<any> {
    console.log(`Code Reviewer ${this.id} reviewing: ${task.title}`);
    
    const reviewType = this.determineReviewType(task);
    
    switch (reviewType) {
      case 'code-quality':
        return this.performCodeQualityReview(task);
      case 'security':
        return this.performSecurityReview(task);
      case 'performance':
        return this.performPerformanceReview(task);
      case 'architecture':
        return this.performArchitectureReview(task);
      case 'pull-request':
        return this.performPullRequestReview(task);
      default:
        return this.performGeneralReview(task);
    }
  }

  protected async validateTask(task: Task): Promise<void> {
    if (!task.title || !task.description) {
      throw new Error('Task must have title and description');
    }
    
    if (!task.artifacts || task.artifacts.length === 0) {
      throw new Error('No code artifacts provided for review');
    }
  }

  protected async loadMemory(): Promise<void> {
    console.log('Loading code review patterns and standards');
  }

  protected async saveMemory(): Promise<void> {
    console.log('Saving review history and pattern updates');
  }

  protected async setupTools(): Promise<void> {
    console.log('Setting up static analysis tools and linters');
  }

  private determineReviewType(task: Task): string {
    const description = task.description.toLowerCase();
    
    if (description.includes('quality') || description.includes('standards')) {
      return 'code-quality';
    } else if (description.includes('security') || description.includes('vulnerability')) {
      return 'security';
    } else if (description.includes('performance') || description.includes('optimization')) {
      return 'performance';
    } else if (description.includes('architecture') || description.includes('design')) {
      return 'architecture';
    } else if (description.includes('pr') || description.includes('pull request')) {
      return 'pull-request';
    }
    
    return 'general';
  }

  private async performCodeQualityReview(_task: Task): Promise<ReviewResult> {
    const issues: ReviewIssue[] = [
      {
        severity: 'high',
        category: 'naming',
        file: 'src/utils/helper.ts',
        line: 42,
        description: 'Function name "doStuff" is not descriptive',
        suggestion: 'Rename to reflect actual functionality, e.g., "processUserData"',
      },
      {
        severity: 'medium',
        category: 'complexity',
        file: 'src/services/user.service.ts',
        line: 156,
        description: 'Cyclomatic complexity of 15 exceeds threshold of 10',
        suggestion: 'Extract complex logic into separate methods',
      },
      {
        severity: 'low',
        category: 'formatting',
        file: 'src/controllers/api.controller.ts',
        line: 78,
        description: 'Inconsistent indentation',
        suggestion: 'Use consistent 2-space indentation',
      },
    ];

    const result: ReviewResult = {
      approved: issues.filter(i => i.severity === 'critical' || i.severity === 'high').length === 0,
      score: this.calculateQualityScore(issues),
      issues,
      suggestions: [
        'Consider adding more unit tests for edge cases',
        'Update JSDoc comments for public methods',
        'Use TypeScript strict mode for better type safety',
      ],
      blockers: issues
        .filter(i => i.severity === 'critical')
        .map(i => i.description),
    };

    return result;
  }

  private async performSecurityReview(_task: Task): Promise<ReviewResult> {
    const securityIssues: ReviewIssue[] = [
      {
        severity: 'critical',
        category: 'security',
        file: 'src/api/auth.controller.ts',
        line: 34,
        description: 'SQL injection vulnerability in raw query',
        suggestion: 'Use parameterized queries or ORM methods',
      },
      {
        severity: 'high',
        category: 'security',
        file: 'src/utils/crypto.ts',
        line: 12,
        description: 'Weak encryption algorithm (MD5) used',
        suggestion: 'Use bcrypt or argon2 for password hashing',
      },
      {
        severity: 'medium',
        category: 'security',
        file: 'src/middleware/cors.ts',
        line: 8,
        description: 'CORS allows all origins',
        suggestion: 'Restrict CORS to specific allowed origins',
      },
    ];

    return {
      approved: false,
      score: 40,
      issues: securityIssues,
      suggestions: [
        'Implement input validation for all user inputs',
        'Add rate limiting to prevent brute force attacks',
        'Use environment variables for sensitive configuration',
      ],
      blockers: ['SQL injection vulnerability must be fixed'],
    };
  }

  private async performPerformanceReview(_task: Task): Promise<ReviewResult> {
    const performanceIssues: ReviewIssue[] = [
      {
        severity: 'high',
        category: 'performance',
        file: 'src/services/data.service.ts',
        line: 89,
        description: 'N+1 query problem in loop',
        suggestion: 'Use eager loading or batch queries',
      },
      {
        severity: 'medium',
        category: 'performance',
        file: 'src/utils/array.ts',
        line: 45,
        description: 'Inefficient array search O(n²)',
        suggestion: 'Use Map or Set for O(1) lookup',
      },
      {
        severity: 'low',
        category: 'performance',
        file: 'src/components/list.tsx',
        line: 23,
        description: 'Missing React.memo for pure component',
        suggestion: 'Wrap component in React.memo to prevent unnecessary re-renders',
      },
    ];

    return {
      approved: true,
      score: 75,
      issues: performanceIssues,
      suggestions: [
        'Consider implementing caching for frequently accessed data',
        'Add database indexes for commonly queried fields',
        'Profile application to identify bottlenecks',
      ],
      blockers: [],
    };
  }

  private async performArchitectureReview(_task: Task): Promise<ReviewResult> {
    const architectureIssues: ReviewIssue[] = [
      {
        severity: 'high',
        category: 'architecture',
        file: 'src/controllers/user.controller.ts',
        line: 0,
        description: 'Business logic in controller layer',
        suggestion: 'Move business logic to service layer',
      },
      {
        severity: 'medium',
        category: 'architecture',
        file: 'src/services/email.service.ts',
        line: 0,
        description: 'Tight coupling to specific email provider',
        suggestion: 'Use adapter pattern for email provider abstraction',
      },
    ];

    return {
      approved: true,
      score: 80,
      issues: architectureIssues,
      suggestions: [
        'Consider implementing repository pattern for data access',
        'Use dependency injection for better testability',
        'Add interface definitions for service contracts',
      ],
      blockers: [],
    };
  }

  private async performPullRequestReview(_task: Task): Promise<ReviewResult> {
    const allIssues: ReviewIssue[] = [
      {
        severity: 'medium',
        category: 'testing',
        file: 'src/services/new-feature.ts',
        line: 0,
        description: 'Missing unit tests for new feature',
        suggestion: 'Add comprehensive test coverage (aim for >80%)',
      },
      {
        severity: 'low',
        category: 'documentation',
        file: 'README.md',
        line: 0,
        description: 'Documentation not updated for new feature',
        suggestion: 'Update README with new feature usage',
      },
    ];

    return {
      approved: true,
      score: 85,
      issues: allIssues,
      suggestions: [
        'Great work on the implementation!',
        'Please add tests before merging',
        'Consider adding feature flag for gradual rollout',
      ],
      blockers: [],
    };
  }

  private async performGeneralReview(_task: Task): Promise<ReviewResult> {
    return {
      approved: true,
      score: 90,
      issues: [],
      suggestions: [
        'Code looks good overall',
        'Consider adding more comments for complex logic',
      ],
      blockers: [],
    };
  }

  private calculateQualityScore(issues: ReviewIssue[]): number {
    const severityWeights = {
      critical: 25,
      high: 15,
      medium: 5,
      low: 2,
    };

    const totalPenalty = issues.reduce((sum, issue) => {
      return sum + severityWeights[issue.severity];
    }, 0);

    return Math.max(0, 100 - totalPenalty);
  }
}