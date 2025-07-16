import { Injectable } from '@nestjs/common';
import { BaseAgent } from '@core/agents/base-agent';
import type {
  AgentCapabilities,
  AgentConfig,
  Task,
} from '@interfaces/agent.interface';

interface DocumentationResult {
  type: string;
  files: string[];
  sections: string[];
  wordCount: number;
  completeness: number;
}

@Injectable()
export class DocSpecialistAgent extends BaseAgent {
  constructor() {
    const config: AgentConfig = {
      persona: 'doc_specialist',
      traits: {
        clarity: 0.95,
        organization: 0.9,
        pedagogical_skill: 0.85,
        completeness: 0.9,
        accessibility: 0.85,
      },
      responsibilities: [
        'API documentation',
        'Code documentation',
        'Architecture documentation',
        'User guides',
        'Developer onboarding',
        'Release notes',
      ],
      communicationStyle: {
        tone: 'educational',
        verbosity: 'comprehensive',
        technicalLevel: 'adaptive',
      },
    };
    super(config);
  }

  defineCapabilities(): AgentCapabilities {
    return {
      languages: ['markdown', 'typescript', 'javascript'],
      frameworks: ['docusaurus', 'mkdocs', 'swagger', 'jsdoc'],
      specialties: ['technical_writing', 'api_docs', 'tutorials'],
    };
  }

  protected async performTask(task: Task): Promise<any> {
    console.log(`Doc Specialist ${this.id} documenting: ${task.title}`);
    
    const docType = this.determineDocumentationType(task);
    
    switch (docType) {
      case 'api':
        return this.createAPIDocumentation(task);
      case 'code':
        return this.createCodeDocumentation(task);
      case 'architecture':
        return this.createArchitectureDocumentation(task);
      case 'user-guide':
        return this.createUserGuide(task);
      case 'release-notes':
        return this.createReleaseNotes(task);
      default:
        return this.createGeneralDocumentation(task);
    }
  }

  protected async validateTask(task: Task): Promise<void> {
    if (!task.title || !task.description) {
      throw new Error('Task must have title and description');
    }
    
    if (!task.artifacts || task.artifacts.length === 0) {
      console.warn('No source artifacts provided, will create documentation from scratch');
    }
  }

  protected async loadMemory(): Promise<void> {
    console.log('Loading documentation templates and style guides');
  }

  protected async saveMemory(): Promise<void> {
    console.log('Saving documentation patterns and glossary');
  }

  protected async setupTools(): Promise<void> {
    console.log('Setting up documentation generation tools');
  }

  private determineDocumentationType(task: Task): string {
    const description = task.description.toLowerCase();
    
    if (description.includes('api') || description.includes('endpoint')) {
      return 'api';
    } else if (description.includes('code') || description.includes('function')) {
      return 'code';
    } else if (description.includes('architecture') || description.includes('design')) {
      return 'architecture';
    } else if (description.includes('user') || description.includes('guide')) {
      return 'user-guide';
    } else if (description.includes('release') || description.includes('changelog')) {
      return 'release-notes';
    }
    
    return 'general';
  }

  private async createAPIDocumentation(_task: Task): Promise<DocumentationResult> {
    return {
      type: 'api',
      files: ['docs/api/openapi.yaml', 'docs/api/README.md'],
      sections: ['Overview', 'Authentication', 'Endpoints', 'Models', 'Examples'],
      wordCount: 2500,
      completeness: 95,
    };
  }

  private async createCodeDocumentation(_task: Task): Promise<DocumentationResult> {
    return {
      type: 'code',
      files: ['docs/code/base-agent.md', 'docs/code/interfaces.md'],
      sections: ['Classes', 'Interfaces', 'Methods', 'Events', 'Examples'],
      wordCount: 1800,
      completeness: 90,
    };
  }

  private async createArchitectureDocumentation(_task: Task): Promise<DocumentationResult> {
    return {
      type: 'architecture',
      files: ['docs/architecture/system-design.md', 'docs/architecture/data-flow.md'],
      sections: ['Overview', 'Components', 'Data Flow', 'Scalability', 'Security'],
      wordCount: 3200,
      completeness: 88,
    };
  }

  private async createUserGuide(_task: Task): Promise<DocumentationResult> {
    return {
      type: 'user-guide',
      files: ['docs/guides/user-guide.md', 'docs/guides/quick-start.md'],
      sections: ['Installation', 'Configuration', 'Usage', 'Examples', 'Troubleshooting'],
      wordCount: 4500,
      completeness: 92,
    };
  }

  private async createReleaseNotes(_task: Task): Promise<DocumentationResult> {
    return {
      type: 'release-notes',
      files: ['docs/releases/v2.0.0.md', 'CHANGELOG.md'],
      sections: ['Features', 'Improvements', 'Bug Fixes', 'Breaking Changes', 'Security'],
      wordCount: 1200,
      completeness: 100,
    };
  }

  private async createGeneralDocumentation(_task: Task): Promise<DocumentationResult> {
    return {
      type: 'general',
      files: ['docs/general-documentation.md'],
      sections: ['Overview', 'Details', 'Examples'],
      wordCount: 1000,
      completeness: 85,
    };
  }
}