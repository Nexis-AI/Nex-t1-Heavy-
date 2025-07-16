import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../src/utils/logger';

interface MonitorConfig {
  watchPaths: string[];
  ignorePatterns: string[];
  debounceMs: number;
  autoSync: boolean;
  syncIntervalMs: number;
}

interface GitConfig {
  remoteName: string;
  branchName: string;
  commitMessageTemplate: string;
  maxRetries: number;
  retryDelayMs: number;
  autoPush: boolean;
}

interface AppConfig {
  monitor: MonitorConfig;
  git: GitConfig;
  logging: {
    level: string;
    file: string;
    console: boolean;
  };
}

export class ConfigManager {
  private static logger = new Logger('ConfigManager');
  private static configPath = path.join(process.cwd(), 'config', 'monitor.json');
  private static defaultConfig: AppConfig = {
    monitor: {
      watchPaths: [
        'src/**/*',
        'scripts/**/*',
        'config/**/*',
        'package.json',
        'tsconfig.json',
        'README.md'
      ],
      ignorePatterns: [
        'node_modules/**',
        'dist/**',
        '.git/**',
        '*.log',
        '*.tmp',
        '.env*',
        'coverage/**',
        '.nyc_output/**',
        '*.spec.ts',
        '*.test.ts'
      ],
      debounceMs: 2000,
      autoSync: true,
      syncIntervalMs: 30000 // 30 seconds
    },
    git: {
      remoteName: 'origin',
      branchName: 'main',
      commitMessageTemplate: 'feat: auto-sync changes - {timestamp}',
      maxRetries: 3,
      retryDelayMs: 2000,
      autoPush: true
    },
    logging: {
      level: 'info',
      file: 'logs/monitor.log',
      console: true
    }
  };

  static getMonitorConfig(): MonitorConfig {
    const config = this.loadConfig();
    return config.monitor;
  }

  static getGitConfig(): GitConfig {
    const config = this.loadConfig();
    return config.git;
  }

  static getLoggingConfig() {
    const config = this.loadConfig();
    return config.logging;
  }

  static getFullConfig(): AppConfig {
    return this.loadConfig();
  }

  private static loadConfig(): AppConfig {
    try {
      // Ensure config directory exists
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      // Check if config file exists
      if (!fs.existsSync(this.configPath)) {
        this.createDefaultConfig();
      }

      const configData = fs.readFileSync(this.configPath, 'utf8');
      const config = JSON.parse(configData);

      // Merge with defaults to ensure all required fields exist
      return this.mergeConfigs(this.defaultConfig, config);

    } catch (error) {
      this.logger.error('Failed to load config, using defaults:', error);
      return this.defaultConfig;
    }
  }

  private static createDefaultConfig(): void {
    try {
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      fs.writeFileSync(
        this.configPath,
        JSON.stringify(this.defaultConfig, null, 2),
        'utf8'
      );

      this.logger.info(`Default config created at: ${this.configPath}`);

    } catch (error) {
      this.logger.error('Failed to create default config:', error);
    }
  }

  private static mergeConfigs(defaultConfig: any, userConfig: any): any {
    const merged = { ...defaultConfig };

    for (const key in userConfig) {
      if (userConfig.hasOwnProperty(key)) {
        if (typeof userConfig[key] === 'object' && userConfig[key] !== null && !Array.isArray(userConfig[key])) {
          merged[key] = this.mergeConfigs(defaultConfig[key] || {}, userConfig[key]);
        } else {
          merged[key] = userConfig[key];
        }
      }
    }

    return merged;
  }

  static updateConfig(updates: Partial<AppConfig>): void {
    try {
      const currentConfig = this.loadConfig();
      const updatedConfig = this.mergeConfigs(currentConfig, updates);

      fs.writeFileSync(
        this.configPath,
        JSON.stringify(updatedConfig, null, 2),
        'utf8'
      );

      this.logger.info('Config updated successfully');

    } catch (error) {
      this.logger.error('Failed to update config:', error);
      throw error;
    }
  }

  static validateConfig(config: AppConfig): boolean {
    try {
      // Validate monitor config
      if (!Array.isArray(config.monitor.watchPaths) || config.monitor.watchPaths.length === 0) {
        throw new Error('Monitor watchPaths must be a non-empty array');
      }

      if (!Array.isArray(config.monitor.ignorePatterns)) {
        throw new Error('Monitor ignorePatterns must be an array');
      }

      if (typeof config.monitor.debounceMs !== 'number' || config.monitor.debounceMs < 0) {
        throw new Error('Monitor debounceMs must be a positive number');
      }

      if (typeof config.monitor.autoSync !== 'boolean') {
        throw new Error('Monitor autoSync must be a boolean');
      }

      if (typeof config.monitor.syncIntervalMs !== 'number' || config.monitor.syncIntervalMs < 1000) {
        throw new Error('Monitor syncIntervalMs must be at least 1000ms');
      }

      // Validate git config
      if (typeof config.git.remoteName !== 'string' || config.git.remoteName.trim() === '') {
        throw new Error('Git remoteName must be a non-empty string');
      }

      if (typeof config.git.branchName !== 'string' || config.git.branchName.trim() === '') {
        throw new Error('Git branchName must be a non-empty string');
      }

      if (typeof config.git.commitMessageTemplate !== 'string') {
        throw new Error('Git commitMessageTemplate must be a string');
      }

      if (typeof config.git.maxRetries !== 'number' || config.git.maxRetries < 0) {
        throw new Error('Git maxRetries must be a non-negative number');
      }

      if (typeof config.git.retryDelayMs !== 'number' || config.git.retryDelayMs < 0) {
        throw new Error('Git retryDelayMs must be a non-negative number');
      }

      if (typeof config.git.autoPush !== 'boolean') {
        throw new Error('Git autoPush must be a boolean');
      }

      // Validate logging config
      const validLogLevels = ['error', 'warn', 'info', 'debug'];
      if (!validLogLevels.includes(config.logging.level)) {
        throw new Error(`Logging level must be one of: ${validLogLevels.join(', ')}`);
      }

      if (typeof config.logging.file !== 'string') {
        throw new Error('Logging file must be a string');
      }

      if (typeof config.logging.console !== 'boolean') {
        throw new Error('Logging console must be a boolean');
      }

      return true;

    } catch (error) {
      this.logger.error('Config validation failed:', error);
      return false;
    }
  }

  static getConfigPath(): string {
    return this.configPath;
  }
}