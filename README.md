# Nex-T1-Heavy - Continuous Codebase Monitoring & Sync

Advanced AI Agent Orchestration System with automated codebase monitoring and GitHub synchronization.

## 🚀 Features

- **Real-time File Monitoring**: Watch for changes in source code, configuration files, and documentation
- **Automated Git Sync**: Automatically commit and push changes to GitHub repository
- **Configurable Ignore Patterns**: Exclude files and directories from monitoring
- **Debounced Operations**: Prevent excessive commits with intelligent debouncing
- **Comprehensive Logging**: Detailed logs with multiple levels and file rotation
- **CLI Tools**: Easy-to-use command-line interface for manual operations
- **Systemd Integration**: Run as a system service on Linux
- **Error Handling**: Robust error handling with retry mechanisms

## 📋 Prerequisites

- Node.js 18+ 
- Git repository with remote origin configured
- GitHub access token with appropriate permissions

## 🛠️ Installation

1. **Clone the repository** (if not already done):
   ```bash
   git clone https://github.com/Nexis-AI/Nex-t1-Heavy-.git
   cd Nex-t1-Heavy-
   ```

2. **Run the setup script**:
   ```bash
   npm run setup
   ```

3. **Install dependencies**:
   ```bash
   npm install
   ```

4. **Verify setup**:
   ```bash
   npm run setup validate
   ```

## 🎯 Quick Start

### Start File Monitoring
```bash
# Start monitoring with auto-sync
npm run monitor:watch

# Start monitoring without auto-sync
npm run monitor
```

### Manual Sync Operations
```bash
# Sync all changes
npm run sync all

# Sync specific files
npm run sync files src/agents/tech-lead.agent.ts

# Check git status
npm run sync status

# Pull latest changes
npm run sync pull

# Auto-sync mode (periodic)
npm run sync auto --interval 30000
```

## ⚙️ Configuration

Configuration is stored in `config/monitor.json`. The system creates a default configuration on first run.

### Monitor Configuration
```json
{
  "monitor": {
    "watchPaths": [
      "src/**/*",
      "scripts/**/*",
      "config/**/*",
      "package.json",
      "tsconfig.json"
    ],
    "ignorePatterns": [
      "node_modules/**",
      "dist/**",
      ".git/**",
      "*.log",
      "*.tmp"
    ],
    "debounceMs": 2000,
    "autoSync": true,
    "syncIntervalMs": 30000
  }
}
```

### Git Configuration
```json
{
  "git": {
    "remoteName": "origin",
    "branchName": "main",
    "commitMessageTemplate": "feat: auto-sync changes - {timestamp}",
    "maxRetries": 3,
    "retryDelayMs": 2000,
    "autoPush": true
  }
}
```

## 📁 Project Structure

```
Nex-t1-Heavy/
├── src/
│   ├── agents/           # AI Agent implementations
│   ├── api/             # API controllers and modules
│   ├── core/            # Core system components
│   ├── interfaces/      # TypeScript interfaces
│   └── utils/           # Utility functions (including Logger)
├── scripts/
│   ├── monitor.ts       # Main monitoring script
│   ├── git-sync.ts      # Git synchronization logic
│   ├── config-manager.ts # Configuration management
│   ├── sync.ts          # Manual sync CLI
│   └── setup.ts         # Setup and installation
├── config/
│   └── monitor.json     # Configuration file
├── logs/                # Log files
├── package.json         # Dependencies and scripts
└── tsconfig.json        # TypeScript configuration
```

## 🔧 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run monitor` | Start file monitoring |
| `npm run monitor:watch` | Start monitoring with auto-sync |
| `npm run sync all` | Sync all changes |
| `npm run sync files <files>` | Sync specific files |
| `npm run sync status` | Show git status |
| `npm run sync pull` | Pull latest changes |
| `npm run sync auto` | Run in auto-sync mode |
| `npm run sync config` | Show configuration |
| `npm run setup` | Run full setup |
| `npm run setup validate` | Validate setup |

## 🐳 Docker Support

The project includes Docker support for containerized deployment:

```bash
# Build the image
docker build -t nex-t1-heavy .

# Run with monitoring
docker run -d --name nex-t1-monitor nex-t1-heavy npm run monitor:watch

# Run with volume mounting for persistent logs
docker run -d \
  --name nex-t1-monitor \
  -v $(pwd)/logs:/app/logs \
  -v $(pwd)/config:/app/config \
  nex-t1-heavy npm run monitor:watch
```

## 🔍 Monitoring & Logs

### Log Files
- `logs/combined.log` - All log messages
- `logs/error.log` - Error messages only
- `logs/monitor.log` - Monitor-specific logs

### Log Levels
- `error` - Error messages
- `warn` - Warning messages  
- `info` - Information messages
- `debug` - Debug information
- `verbose` - Verbose logging
- `silly` - Very detailed logging

### Environment Variables
- `LOG_LEVEL` - Set logging level (default: info)
- `LOG_CONSOLE` - Enable console logging (default: true in dev)
- `NODE_ENV` - Environment mode (development/production)

## 🚨 Troubleshooting

### Common Issues

1. **Git authentication errors**
   ```bash
   # Check git remote configuration
   git remote -v
   
   # Verify GitHub token permissions
   npm run sync status
   ```

2. **Permission denied errors**
   ```bash
   # Check file permissions
   ls -la config/monitor.json
   
   # Fix permissions if needed
   chmod 644 config/monitor.json
   ```

3. **Dependencies not found**
   ```bash
   # Reinstall dependencies
   rm -rf node_modules package-lock.json
   npm install
   ```

4. **Monitor not detecting changes**
   ```bash
   # Check configuration
   npm run sync config
   
   # Verify watch paths
   cat config/monitor.json | grep watchPaths
   ```

### Debug Mode
```bash
# Enable debug logging
LOG_LEVEL=debug npm run monitor:watch

# Check detailed git operations
LOG_LEVEL=debug npm run sync all
```

## 🔒 Security Considerations

- **GitHub Token**: Store tokens securely, never commit them to version control
- **File Permissions**: Ensure proper file permissions for configuration and logs
- **Network Security**: Use HTTPS for all remote operations
- **Log Security**: Rotate log files and monitor for sensitive information

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

For issues and questions:
- Check the troubleshooting section
- Review logs in the `logs/` directory
- Open an issue on GitHub

## 🔄 Version History

- **v1.0.0** - Initial release with basic monitoring and sync
- **v1.1.0** - Added CLI tools and configuration management
- **v1.2.0** - Enhanced logging and error handling
- **v1.3.0** - Added Docker support and systemd integration