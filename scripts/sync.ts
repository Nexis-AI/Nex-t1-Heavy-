#!/usr/bin/env ts-node

import { program } from 'commander';
import { GitSync } from './git-sync';
import { Logger } from '../src/utils/logger';
import { ConfigManager } from './config-manager';

class SyncManager {
  private logger: Logger;
  private gitSync: GitSync;

  constructor() {
    this.logger = new Logger('SyncManager');
    this.gitSync = new GitSync();
  }

  async initialize(): Promise<void> {
    try {
      await this.gitSync.initialize();
      this.logger.info('Sync manager initialized');
    } catch (error) {
      this.logger.error('Failed to initialize sync manager:', error);
      throw error;
    }
  }

  async syncAll(): Promise<void> {
    try {
      this.logger.info('Starting full sync...');
      
      // Get git status
      const status = await this.gitSync.getStatus();
      
      if (status.files.length === 0) {
        this.logger.info('No changes to sync');
        return;
      }

      this.logger.info(`Found ${status.files.length} changed files`);
      
      // Sync all changes
      await this.gitSync.syncChanges([]);
      
      this.logger.info('Full sync completed successfully');
      
    } catch (error) {
      this.logger.error('Full sync failed:', error);
      throw error;
    }
  }

  async syncFiles(files: string[]): Promise<void> {
    try {
      this.logger.info(`Syncing specific files: ${files.join(', ')}`);
      
      await this.gitSync.syncChanges(files);
      
      this.logger.info('File sync completed successfully');
      
    } catch (error) {
      this.logger.error('File sync failed:', error);
      throw error;
    }
  }

  async pullLatest(): Promise<void> {
    try {
      this.logger.info('Pulling latest changes...');
      
      await this.gitSync.pullLatest();
      
      this.logger.info('Pull completed successfully');
      
    } catch (error) {
      this.logger.error('Pull failed:', error);
      throw error;
    }
  }

  async getStatus(): Promise<void> {
    try {
      const status = await this.gitSync.getStatus();
      const lastCommit = await this.gitSync.getLastCommit();
      
      console.log('\n=== Git Status ===');
      console.log(`Current branch: ${status.current}`);
      console.log(`Tracking: ${status.tracking || 'none'}`);
      console.log(`Ahead: ${status.ahead}`);
      console.log(`Behind: ${status.behind}`);
      
      if (status.files.length > 0) {
        console.log('\n=== Changed Files ===');
        status.files.forEach(file => {
          const status = [];
          if (file.index !== ' ') status.push(`index:${file.index}`);
          if (file.working_dir !== ' ') status.push(`working:${file.working_dir}`);
          console.log(`${file.path} (${status.join(', ')})`);
        });
      } else {
        console.log('\nNo changes detected');
      }
      
      if (lastCommit) {
        console.log('\n=== Last Commit ===');
        console.log(`Hash: ${lastCommit.hash}`);
        console.log(`Author: ${lastCommit.author_name}`);
        console.log(`Date: ${lastCommit.date}`);
        console.log(`Message: ${lastCommit.message}`);
      }
      
    } catch (error) {
      this.logger.error('Failed to get status:', error);
      throw error;
    }
  }

  async showConfig(): Promise<void> {
    try {
      const config = ConfigManager.getFullConfig();
      
      console.log('\n=== Monitor Configuration ===');
      console.log(JSON.stringify(config, null, 2));
      
    } catch (error) {
      this.logger.error('Failed to show config:', error);
      throw error;
    }
  }
}

// CLI setup
program
  .name('sync')
  .description('Git sync utility for Nex-T1-Heavy project')
  .version('1.0.0');

program
  .command('all')
  .description('Sync all changes')
  .action(async () => {
    const syncManager = new SyncManager();
    await syncManager.initialize();
    await syncManager.syncAll();
  });

program
  .command('files')
  .description('Sync specific files')
  .argument('<files...>', 'Files to sync')
  .action(async (files: string[]) => {
    const syncManager = new SyncManager();
    await syncManager.initialize();
    await syncManager.syncFiles(files);
  });

program
  .command('pull')
  .description('Pull latest changes from remote')
  .action(async () => {
    const syncManager = new SyncManager();
    await syncManager.initialize();
    await syncManager.pullLatest();
  });

program
  .command('status')
  .description('Show git status')
  .action(async () => {
    const syncManager = new SyncManager();
    await syncManager.initialize();
    await syncManager.getStatus();
  });

program
  .command('config')
  .description('Show current configuration')
  .action(async () => {
    const syncManager = new SyncManager();
    await syncManager.showConfig();
  });

program
  .command('auto')
  .description('Run in auto-sync mode')
  .option('--interval <ms>', 'Sync interval in milliseconds', '30000')
  .action(async (options) => {
    const syncManager = new SyncManager();
    await syncManager.initialize();
    
    const interval = parseInt(options.interval);
    console.log(`Starting auto-sync with ${interval}ms interval...`);
    
    // Run initial sync
    await syncManager.syncAll();
    
    // Set up periodic sync
    setInterval(async () => {
      try {
        await syncManager.syncAll();
      } catch (error) {
        console.error('Auto-sync failed:', error);
      }
    }, interval);
    
    // Keep process alive
    process.on('SIGINT', () => {
      console.log('\nStopping auto-sync...');
      process.exit(0);
    });
  });

program.parse();