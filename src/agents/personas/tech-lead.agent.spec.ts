import { TechLeadAgent } from './tech-lead.agent';
import type { Task } from '@interfaces/agent.interface';

describe('TechLeadAgent', () => {
  let agent: TechLeadAgent;

  beforeEach(() => {
    agent = new TechLeadAgent();
  });

  afterEach(() => {
    agent.removeAllListeners();
  });

  describe('constructor', () => {
    it('should create tech lead with correct traits', () => {
      expect(agent.persona).toBe('tech_lead');
      expect(agent.traits).toEqual({
        leadership: 0.9,
        technical_depth: 0.85,
        strategic_thinking: 0.95,
        decision_making: 0.9,
        conflict_resolution: 0.85,
      });
    });
  });

  describe('defineCapabilities', () => {
    it('should define correct capabilities', () => {
      const capabilities = agent.defineCapabilities();
      
      expect(capabilities.languages).toContain('typescript');
      expect(capabilities.languages).toContain('javascript');
      expect(capabilities.languages).toContain('python');
      expect(capabilities.languages).toContain('go');
      
      expect(capabilities.frameworks).toContain('nestjs');
      expect(capabilities.frameworks).toContain('react');
      
      expect(capabilities.specialties).toContain('architecture');
      expect(capabilities.specialties).toContain('scalability');
      expect(capabilities.specialties).toContain('security');
    });
  });

  describe('performTask', () => {
    it('should handle architecture review tasks', async () => {
      const task: Task = {
        id: 'task-1',
        title: 'Review System Architecture',
        description: 'architecture_review',
        assignedTo: 'tech_lead',
        priority: 'HIGH',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await agent.initialize();
      const result = await agent['performTask'](task);

      expect(result).toEqual({
        review: 'Architecture review completed',
        recommendations: expect.arrayContaining([
          'Consider microservices pattern',
          'Implement caching layer',
          'Add monitoring',
        ]),
        approvalStatus: 'approved_with_conditions',
      });
    });

    it('should handle conflict resolution tasks', async () => {
      const task: Task = {
        id: 'task-2',
        title: 'Resolve Technical Conflict',
        description: 'conflict_resolution',
        assignedTo: 'tech_lead',
        priority: 'CRITICAL',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await agent.initialize();
      const result = await agent['performTask'](task);

      expect(result).toEqual({
        resolution: 'Conflict resolved through technical analysis',
        decision: 'Proceed with option A',
        rationale: 'Better scalability and maintainability',
      });
    });

    it('should handle technology decision tasks', async () => {
      const task: Task = {
        id: 'task-3',
        title: 'Select Database Technology',
        description: 'technology_decision',
        assignedTo: 'tech_lead',
        priority: 'HIGH',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await agent.initialize();
      const result = await agent['performTask'](task);

      expect(result).toEqual({
        decision: 'Selected technology stack',
        technologies: ['NestJS', 'PostgreSQL', 'Redis'],
        justification: 'Best fit for requirements and team expertise',
      });
    });
  });

  describe('validateTask', () => {
    it('should validate tasks with authority', async () => {
      const validTask: Task = {
        id: 'task-4',
        title: 'Architecture Decision',
        description: 'Review and approve new architecture pattern',
        assignedTo: 'tech_lead',
        priority: 'HIGH',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await expect(agent['validateTask'](validTask)).resolves.not.toThrow();
    });

    it('should reject tasks without authority', async () => {
      const invalidTask: Task = {
        id: 'task-5',
        title: 'Simple Bug Fix',
        description: 'Fix minor UI issue',
        assignedTo: 'tech_lead',
        priority: 'LOW',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await expect(agent['validateTask'](invalidTask)).rejects.toThrow(
        'Tech Lead does not have authority for this task type',
      );
    });
  });
});