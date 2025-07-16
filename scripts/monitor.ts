#!/usr/bin/env ts-node

import * as chokidar from 'chokidar';
import * as path from 'path';
import * as fs from 'fs';
import { program } from 'commander';
import { Logger } from '../src/utils/logger';
import { GitSync } from './git-sync';
import { ConfigManager } from './config-manager';

interface MonitorConfig {
  watchPaths: string[];
  ignorePatterns: string[];
  debounceMs: number;
  autoSync: boolean;
  syncIntervalMs: number;
}

class CodebaseMonitor {
  private logger: Logger;
  private gitSync: GitSync;
  private config: MonitorConfig;
  private watcher: chokidar.FSWatcher | null = null;
  private changeQueue: Set<string> = new Set();
  private syncTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.logger = new Logger('CodebaseMonitor');
    this.gitSync = new GitSync();
    this.config = ConfigManager.getMonitorConfig();
  }

  async start(): Promise<void> {
    try {
      this.logger.info('Starting codebase monitor...');
      
      // Initialize git sync
      await this.gitSync.initialize();
      
      // Start file watching
      await this.startFileWatching();
      
      // Start periodic sync if enabled
      if (this.config.autoSync) {
        this.startPeriodicSync();
      }
      
      this.logger.info('Codebase monitor started successfully');
      this.logger.info(`Watching paths: ${this.config.watchPaths.join(', ')}`);
      this.logger.info(`Auto sync: ${this.config.autoSync ? 'enabled' : 'disabled'}`);
      
    } catch (error) {
      this.logger.error('Failed to start monitor:', error);
      process.exit(1);
    }
  }

  private async startFileWatching(): Promise<void> {
    const watchOptions: chokidar.WatchOptions = {
      ignored: this.config.ignorePatterns,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 1000,
        pollInterval: 100
      }
    };

    this.watcher = chokidar.watch(this.config.watchPaths, watchOptions);

    this.watcher
      .on('add', (filePath) => this.handleFileChange('add', filePath))
      .on('change', (filePath) => this.handleFileChange('change', filePath))
      .on('unlink', (filePath) => this.handleFileChange('unlink', filePath))
      .on('error', (error) => this.logger.error('Watcher error:', error))
      .on('ready', () => this.logger.info('File watcher ready'));
  }

  private handleFileChange(event: string, filePath: string): void {
    const relativePath = path.relative(process.cwd(), filePath);
    
    // Skip if file is in ignore patterns
    if (this.shouldIgnoreFile(relativePath)) {
      return;
    }

    this.logger.info(`File ${event}: ${relativePath}`);
    this.changeQueue.add(relativePath);

    // Debounce sync operations
    this.debounceSync();
  }

  private shouldIgnoreFile(filePath: string): boolean {
    return this.config.ignorePatterns.some(pattern => {
      if (typeof pattern === 'string') {
        return filePath.includes(pattern);
      }
      return pattern.test(filePath);
    });
  }

  private debounceSync(): void {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }

    this.syncTimeout = setTimeout(async () => {
      await this.performSync();
    }, this.config.debounceMs);
  }

  private async performSync(): Promise<void> {
    if (this.changeQueue.size === 0) {
      return;
    }

    try {
      const changedFiles = Array.from(this.changeQueue);
      this.logger.info(`Syncing ${changedFiles.length} changed files...`);
      
      await this.gitSync.syncChanges(changedFiles);
      
      this.changeQueue.clear();
      this.logger.info('Sync completed successfully');
      
    } catch (error) {
      this.logger.error('Sync failed:', error);
    }
  }

  private startPeriodicSync(): void {
    setInterval(async () => {
      if (this.changeQueue.size > 0) {
        this.logger.info('Periodic sync triggered');
        await this.performSync();
      }
    }, this.config.syncIntervalMs);
  }

  async stop(): Promise<void> {
    this.logger.info('Stopping codebase monitor...');
    
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }
    
    if (this.watcher) {
      await this.watcher.close();
    }
    
    this.logger.info('Codebase monitor stopped');
  }
}

// CLI setup
program
  .option('--watch', 'Enable watch mode')
  .option('--auto-sync', 'Enable automatic syncing')
  .option('--config <path>', 'Path to config file')
  .parse(process.argv);

const options = program.opts();

async function main(): Promise<void> {
  const monitor = new CodebaseMonitor();
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    await monitor.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    await monitor.stop();
    process.exit(0);
  });
  
  await monitor.start();
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Monitor failed:', error);
    process.exit(1);
  });
}