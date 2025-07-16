# Nex-t1 Heavy: Multi-Agent AI System with Claude & Gemini Integration

## Overview

Nex-t1 Heavy is a production-grade multi-agent AI system that intelligently leverages both **Claude Opus 4** and **Gemini 2.0 Flash** to overcome context window limitations and optimize for different task types. This system implements the architecture described in the [blueprint.md](./blueprint.md).

## Key Features

### 🤖 Multi-Model Intelligence
- **Claude Opus 4**: Primary model for complex reasoning, code generation, and nuanced analysis (200k token context)
- **Gemini 2.0 Flash**: Extended context processing up to 1M tokens for large-scale analysis
- **Intelligent Routing**: Automatic model selection based on context size and task requirements
- **Context Overflow Handling**: Seamless fallback to Gemini when Claude's limits are exceeded

### 🏗️ Architecture Highlights
- **Orchestrator-Worker Pattern**: Hierarchical agent coordination
- **Monorepo Structure**: Organized packages for agents, shared utilities, and workflows
- **TypeScript First**: Full type safety with TypeScript 5.0+
- **Cursor.sh Integration**: AI-optimized development with .mdc rule files

## Quick Start

### Prerequisites
- Node.js 18+
- PNPM 8+
- API Keys for Claude and Gemini

### Installation

1. Clone the repository:
```bash
git clone https://github.com/nexisai/nex-t1-heavy.git
cd nex-t1-heavy
```

2. Install dependencies:
```bash
pnpm install
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your API keys
```

4. Build the project:
```bash
pnpm build
```

## Multi-Model Configuration

### Environment Variables

```env
# Claude Configuration
ANTHROPIC_API_KEY=your-anthropic-api-key
ANTHROPIC_MODEL=claude-opus-4-20250514
CLAUDE_CODE_MAX_OUTPUT_TOKENS=32768

# Gemini Configuration  
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.0-flash-exp
GEMINI_MAX_CONTEXT_TOKENS=1048576

# Multi-Model Settings
MULTI_MODEL_ENABLED=true
CONTEXT_OVERFLOW_MODEL=gemini
```

### Usage Example

```typescript
import { MultiModelOrchestrator } from '@nex-t1/orchestrator';

const orchestrator = new MultiModelOrchestrator();

// Small task - uses Claude for quality
const codeGenTask = {
  id: 'task-001',
  type: 'generation',
  description: 'Create a REST API endpoint',
  files: ['api/users.ts'],
  priority: 'high'
};

// Large analysis - automatically uses Gemini
const repoAnalysis = await orchestrator.analyzeRepository(
  './large-codebase',
  'security vulnerabilities and performance issues'
);
```

## Model Selection Logic

The system intelligently routes requests based on:

1. **Context Size**:
   - < 200k tokens → Claude (better reasoning)
   - > 200k tokens → Gemini (larger context)

2. **Task Type**:
   - Code Generation → Claude (superior code quality)
   - Large-scale Analysis → Gemini (can process entire repos)
   - Cost-sensitive Batch → Gemini (200x cheaper)

3. **Priority**:
   - High Priority → Claude (maximum quality)
   - Speed/Cost Priority → Gemini (faster, cheaper)

## Cursor.sh Integration

The project includes specialized .mdc files for AI-assisted development:

- `.cursor/rules/000-core-orchestrator.mdc` - Lead orchestrator configuration
- `.cursor/rules/400-multi-model-context.mdc` - Multi-model coordination rules
- `.cursor/rules/agents/*.mdc` - Individual agent configurations

These rules enable Cursor.sh to understand the multi-model architecture and provide context-aware assistance.

## Project Structure

```
nex-t1-heavy/
├── packages/
│   ├── agents/           # AI agents
│   │   ├── orchestrator/ # Multi-model orchestrator
│   │   └── workers/      # Specialized agents
│   └── shared/           # Shared utilities
│       └── context/      # Multi-model context manager
├── .cursor/              # Cursor.sh AI rules
└── docs/                 # Documentation
```

## Development Roadmap

- [x] Multi-model context management
- [x] Intelligent routing between Claude and Gemini
- [ ] Streaming responses for large contexts
- [ ] Cost optimization algorithms
- [ ] Performance monitoring dashboard
- [ ] Advanced chunking strategies
- [ ] Model-specific prompt optimization

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines.

## License

MIT License - see [LICENSE](./LICENSE) for details.