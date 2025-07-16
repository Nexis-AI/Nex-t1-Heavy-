import { simpleGit, SimpleGit, SimpleGitOptions } from 'simple-git';
import * as path from 'path';
import { Logger } from '../src/utils/logger';

interface GitConfig {
  remoteName: string;
  branchName: string;
  commitMessageTemplate: string;
  maxRetries: number;
  retryDelayMs: number;
  autoPush: boolean;
}

export class GitSync {
  private git: SimpleGit;
  private logger: Logger;
  private config: GitConfig;
  private isInitialized: boolean = false;

  constructor() {
    this.logger = new Logger('GitSync');
    this.config = this.getDefaultConfig();
    
    const gitOptions: SimpleGitOptions = {
      baseDir: process.cwd(),
      binary: 'git',
      maxConcurrentProcesses: 6,
      trimmed: false,
    };
    
    this.git = simpleGit(gitOptions);
  }

  private getDefaultConfig(): GitConfig {
    return {
      remoteName: 'origin',
      branchName: 'main',
      commitMessageTemplate: 'feat: auto-sync changes - {timestamp}',
      maxRetries: 3,
      retryDelayMs: 2000,
      autoPush: true
    };
  }

  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Git sync...');
      
      // Check if we're in a git repository
      const isRepo = await this.git.checkIsRepo();
      if (!isRepo) {
        throw new Error('Not a git repository');
      }

      // Get current branch
      const currentBranch = await this.git.branch();
      this.config.branchName = currentBranch.current;
      
      // Check remote configuration
      const remotes = await this.git.getRemotes(true);
      const originRemote = remotes.find(remote => remote.name === this.config.remoteName);
      
      if (!originRemote) {
        throw new Error(`Remote '${this.config.remoteName}' not found`);
      }

      this.isInitialized = true;
      this.logger.info(`Git sync initialized on branch: ${this.config.branchName}`);
      this.logger.info(`Remote: ${originRemote.refs.push}`);
      
    } catch (error) {
      this.logger.error('Failed to initialize Git sync:', error);
      throw error;
    }
  }

  async syncChanges(changedFiles: string[]): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Git sync not initialized');
    }

    if (changedFiles.length === 0) {
      this.logger.info('No changes to sync');
      return;
    }

    try {
      // Check git status
      const status = await this.git.status();
      
      if (status.files.length === 0) {
        this.logger.info('No changes detected in git status');
        return;
      }

      // Stage all changes
      await this.stageChanges(changedFiles);
      
      // Create commit
      const commitMessage = this.generateCommitMessage(changedFiles);
      await this.createCommit(commitMessage);
      
      // Push changes if auto-push is enabled
      if (this.config.autoPush) {
        await this.pushChanges();
      }
      
    } catch (error) {
      this.logger.error('Failed to sync changes:', error);
      throw error;
    }
  }

  private async stageChanges(files: string[]): Promise<void> {
    try {
      this.logger.info(`Staging ${files.length} files...`);
      
      // Add specific files if provided, otherwise add all
      if (files.length > 0) {
        await this.git.add(files);
      } else {
        await this.git.add('.');
      }
      
      this.logger.info('Files staged successfully');
      
    } catch (error) {
      this.logger.error('Failed to stage changes:', error);
      throw error;
    }
  }

  private generateCommitMessage(files: string[]): string {
    const timestamp = new Date().toISOString();
    const fileCount = files.length;
    const fileList = files.slice(0, 5).join(', ');
    const moreFiles = files.length > 5 ? ` and ${files.length - 5} more` : '';
    
    return this.config.commitMessageTemplate
      .replace('{timestamp}', timestamp)
      .replace('{files}', `${fileList}${moreFiles}`)
      .replace('{count}', fileCount.toString());
  }

  private async createCommit(message: string): Promise<void> {
    try {
      this.logger.info(`Creating commit: ${message}`);
      
      await this.git.commit(message);
      
      this.logger.info('Commit created successfully');
      
    } catch (error) {
      this.logger.error('Failed to create commit:', error);
      throw error;
    }
  }

  private async pushChanges(): Promise<void> {
    let retries = 0;
    
    while (retries < this.config.maxRetries) {
      try {
        this.logger.info(`Pushing changes to ${this.config.remoteName}/${this.config.branchName}...`);
        
        const pushResult = await this.git.push(
          this.config.remoteName,
          this.config.branchName,
          ['--set-upstream']
        );
        
        this.logger.info('Changes pushed successfully');
        this.logger.info(`Push summary: ${pushResult.summary.changes} changes`);
        
        return;
        
      } catch (error) {
        retries++;
        this.logger.warn(`Push attempt ${retries} failed:`, error);
        
        if (retries >= this.config.maxRetries) {
          this.logger.error('Max push retries exceeded');
          throw error;
        }
        
        // Wait before retrying
        await this.delay(this.config.retryDelayMs * retries);
      }
    }
  }

  async pullLatest(): Promise<void> {
    try {
      this.logger.info('Pulling latest changes...');
      
      const pullResult = await this.git.pull(
        this.config.remoteName,
        this.config.branchName
      );
      
      this.logger.info('Latest changes pulled successfully');
      this.logger.info(`Pull summary: ${pullResult.summary.changes} changes`);
      
    } catch (error) {
      this.logger.error('Failed to pull latest changes:', error);
      throw error;
    }
  }

  async getStatus(): Promise<any> {
    try {
      const status = await this.git.status();
      return {
        current: status.current,
        tracking: status.tracking,
        ahead: status.ahead,
        behind: status.behind,
        files: status.files.map(file => ({
          path: file.path,
          index: file.index,
          working_dir: file.working_dir
        }))
      };
    } catch (error) {
      this.logger.error('Failed to get git status:', error);
      throw error;
    }
  }

  async getLastCommit(): Promise<any> {
    try {
      const log = await this.git.log({ maxCount: 1 });
      return log.latest;
    } catch (error) {
      this.logger.error('Failed to get last commit:', error);
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Configuration methods
  setConfig(config: Partial<GitConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): GitConfig {
    return { ...this.config };
  }
}