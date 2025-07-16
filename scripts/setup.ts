#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';
import { program } from 'commander';
import { Logger } from '../src/utils/logger';
import { ConfigManager } from './config-manager';
import { GitSync } from './git-sync';

class SetupManager {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('SetupManager');
  }

  async runSetup(): Promise<void> {
    try {
      this.logger.info('Starting Nex-T1-Heavy monitoring setup...');

      // Create necessary directories
      await this.createDirectories();

      // Initialize configuration
      await this.initializeConfig();

      // Verify git setup
      await this.verifyGitSetup();

      // Install dependencies
      await this.installDependencies();

      // Create systemd service (if on Linux)
      await this.createSystemdService();

      this.logger.info('Setup completed successfully!');
      this.printNextSteps();

    } catch (error) {
      this.logger.error('Setup failed:', error);
      throw error;
    }
  }

  private async createDirectories(): Promise<void> {
    const directories = [
      'logs',
      'config',
      'dist',
      'src/utils'
    ];

    for (const dir of directories) {
      const dirPath = path.join(process.cwd(), dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        this.logger.info(`Created directory: ${dir}`);
      }
    }
  }

  private async initializeConfig(): Promise<void> {
    try {
      // This will create the default config if it doesn't exist
      ConfigManager.getFullConfig();
      this.logger.info('Configuration initialized');
    } catch (error) {
      this.logger.error('Failed to initialize configuration:', error);
      throw error;
    }
  }

  private async verifyGitSetup(): Promise<void> {
    try {
      const gitSync = new GitSync();
      await gitSync.initialize();
      
      const status = await gitSync.getStatus();
      this.logger.info(`Git setup verified. Current branch: ${status.current}`);
      
    } catch (error) {
      this.logger.error('Git setup verification failed:', error);
      throw error;
    }
  }

  private async installDependencies(): Promise<void> {
    try {
      this.logger.info('Installing dependencies...');
      
      // Check if package.json exists
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      if (!fs.existsSync(packageJsonPath)) {
        throw new Error('package.json not found. Please run this script from the project root.');
      }

      // Run npm install
      const { exec } = require('child_process');
      const util = require('util');
      const execAsync = util.promisify(exec);

      const { stdout, stderr } = await execAsync('npm install');
      
      if (stderr) {
        this.logger.warn('npm install warnings:', stderr);
      }
      
      this.logger.info('Dependencies installed successfully');
      
    } catch (error) {
      this.logger.error('Failed to install dependencies:', error);
      throw error;
    }
  }

  private async createSystemdService(): Promise<void> {
    try {
      // Only create systemd service on Linux
      if (process.platform !== 'linux') {
        this.logger.info('Skipping systemd service creation (not on Linux)');
        return;
      }

      const serviceName = 'nex-t1-monitor';
      const serviceContent = `[Unit]
Description=Nex-T1-Heavy Codebase Monitor
After=network.target

[Service]
Type=simple
User=${process.env.USER || 'ubuntu'}
WorkingDirectory=${process.cwd()}
ExecStart=/usr/bin/npm run monitor:watch
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=LOG_LEVEL=info

[Install]
WantedBy=multi-user.target
`;

      const servicePath = `/etc/systemd/system/${serviceName}.service`;
      
      // Check if we have write permissions
      try {
        fs.accessSync('/etc/systemd/system', fs.constants.W_OK);
      } catch {
        this.logger.warn('No write permission to /etc/systemd/system. Skipping systemd service creation.');
        this.logger.info('You can manually create the service file with sudo privileges.');
        return;
      }

      fs.writeFileSync(servicePath, serviceContent);
      this.logger.info(`Systemd service created: ${servicePath}`);
      
      // Enable the service
      const { exec } = require('child_process');
      const util = require('util');
      const execAsync = util.promisify(exec);

      await execAsync(`sudo systemctl daemon-reload`);
      await execAsync(`sudo systemctl enable ${serviceName}`);
      
      this.logger.info(`Systemd service enabled: ${serviceName}`);
      this.logger.info(`To start the service: sudo systemctl start ${serviceName}`);
      this.logger.info(`To check status: sudo systemctl status ${serviceName}`);
      
    } catch (error) {
      this.logger.warn('Failed to create systemd service:', error);
      this.logger.info('You can manually create the service file or run the monitor manually.');
    }
  }

  private printNextSteps(): void {
    console.log('\n=== Setup Complete ===');
    console.log('\nNext steps:');
    console.log('1. Review configuration: npm run sync config');
    console.log('2. Test monitoring: npm run monitor');
    console.log('3. Test sync: npm run sync status');
    console.log('4. Start auto-sync: npm run sync auto');
    console.log('5. Start file watching: npm run monitor:watch');
    console.log('\nConfiguration file: config/monitor.json');
    console.log('Logs directory: logs/');
    console.log('\nFor help: npm run sync --help');
  }

  async validateSetup(): Promise<void> {
    try {
      this.logger.info('Validating setup...');

      // Check required files
      const requiredFiles = [
        'package.json',
        'tsconfig.json',
        'config/monitor.json'
      ];

      for (const file of requiredFiles) {
        if (!fs.existsSync(path.join(process.cwd(), file))) {
          throw new Error(`Required file missing: ${file}`);
        }
      }

      // Check git setup
      const gitSync = new GitSync();
      await gitSync.initialize();

      // Check dependencies
      const nodeModulesPath = path.join(process.cwd(), 'node_modules');
      if (!fs.existsSync(nodeModulesPath)) {
        throw new Error('Dependencies not installed. Run npm install first.');
      }

      this.logger.info('Setup validation passed!');

    } catch (error) {
      this.logger.error('Setup validation failed:', error);
      throw error;
    }
  }
}

// CLI setup
program
  .name('setup')
  .description('Setup Nex-T1-Heavy monitoring system')
  .version('1.0.0');

program
  .command('install')
  .description('Run full setup')
  .action(async () => {
    const setupManager = new SetupManager();
    await setupManager.runSetup();
  });

program
  .command('validate')
  .description('Validate current setup')
  .action(async () => {
    const setupManager = new SetupManager();
    await setupManager.validateSetup();
  });

program.parse();