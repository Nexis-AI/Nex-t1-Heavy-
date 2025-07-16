import { Anthropic } from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface ModelCapabilities {
  maxContextTokens: number;
  maxOutputTokens: number;
  strengths: string[];
  costPerMillion: number;
}

interface ContextRequirements {
  estimatedTokens: number;
  requiresLargeContext: boolean;
  taskType: 'code_generation' | 'analysis' | 'documentation' | 'review';
  priority: 'speed' | 'accuracy' | 'cost';
}

export class MultiModelContextManager {
  private anthropic: Anthropic;
  private gemini: GoogleGenerativeAI;
  
  private models: Record<string, ModelCapabilities> = {
    'claude-opus-4': {
      maxContextTokens: 200000,
      maxOutputTokens: 32768,
      strengths: ['reasoning', 'code_generation', 'nuanced_analysis'],
      costPerMillion: 15.0
    },
    'gemini-2.0-flash': {
      maxContextTokens: 1048576,
      maxOutputTokens: 8192,
      strengths: ['large_context', 'speed', 'cost_efficiency'],
      costPerMillion: 0.075
    }
  };

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
    
    this.gemini = new GoogleGenerativeAI(
      process.env.GEMINI_API_KEY || ''
    );
  }

  /**
   * Intelligently route requests to the appropriate model based on context requirements
   */
  async routeRequest(
    prompt: string,
    context: string[],
    requirements: ContextRequirements
  ): Promise<{ model: string; response: any }> {
    const totalContext = this.calculateTokenCount(prompt, context);
    
    // Decision logic for model selection
    if (totalContext > this.models['claude-opus-4'].maxContextTokens) {
      // Context too large for Claude, must use Gemini
      return await this.processWithGemini(prompt, context);
    }
    
    // For smaller contexts, choose based on task type and priority
    if (requirements.priority === 'cost' && totalContext < 500000) {
      return await this.processWithGemini(prompt, context);
    }
    
    if (requirements.taskType === 'code_generation' || 
        requirements.taskType === 'review') {
      // Claude excels at code generation and nuanced review
      return await this.processWithClaude(prompt, context);
    }
    
    if (requirements.requiresLargeContext || 
        requirements.taskType === 'analysis') {
      // Gemini for large context analysis
      return await this.processWithGemini(prompt, context);
    }
    
    // Default to Claude for general tasks
    return await this.processWithClaude(prompt, context);
  }

  /**
   * Split large contexts across multiple model calls if needed
   */
  async processLargeContext(
    prompt: string,
    context: string[],
    chunkSize: number = 180000
  ): Promise<any[]> {
    const chunks = this.chunkContext(context, chunkSize);
    const results = [];
    
    for (const chunk of chunks) {
      const result = await this.routeRequest(
        prompt,
        chunk,
        { 
          estimatedTokens: this.calculateTokenCount(prompt, chunk),
          requiresLargeContext: false,
          taskType: 'analysis',
          priority: 'accuracy'
        }
      );
      results.push(result);
    }
    
    // Synthesize results using Claude for better reasoning
    return await this.synthesizeResults(results);
  }

  private async processWithClaude(
    prompt: string,
    context: string[]
  ): Promise<{ model: string; response: any }> {
    const contextString = context.join('\n\n');
    const response = await this.anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-opus-4-20250514',
      max_tokens: parseInt(process.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS || '32768'),
      messages: [{
        role: 'user',
        content: `Context:\n${contextString}\n\nTask:\n${prompt}`
      }]
    });
    
    return { model: 'claude-opus-4', response };
  }

  private async processWithGemini(
    prompt: string,
    context: string[]
  ): Promise<{ model: string; response: any }> {
    const model = this.gemini.getGenerativeModel({ 
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp'
    });
    
    const contextString = context.join('\n\n');
    const result = await model.generateContent(
      `Context:\n${contextString}\n\nTask:\n${prompt}`
    );
    
    return { 
      model: 'gemini-2.0-flash', 
      response: result.response 
    };
  }

  private calculateTokenCount(prompt: string, context: string[]): number {
    // Rough estimation: 1 token ≈ 4 characters
    const totalChars = prompt.length + context.join('').length;
    return Math.ceil(totalChars / 4);
  }

  private chunkContext(context: string[], maxTokens: number): string[][] {
    const chunks: string[][] = [];
    let currentChunk: string[] = [];
    let currentTokens = 0;
    
    for (const item of context) {
      const itemTokens = Math.ceil(item.length / 4);
      
      if (currentTokens + itemTokens > maxTokens) {
        chunks.push(currentChunk);
        currentChunk = [item];
        currentTokens = itemTokens;
      } else {
        currentChunk.push(item);
        currentTokens += itemTokens;
      }
    }
    
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }
    
    return chunks;
  }

  private async synthesizeResults(results: any[]): Promise<any> {
    // Use Claude to synthesize multiple results into coherent output
    const synthesis = await this.anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-opus-4-20250514',
      max_tokens: 8192,
      messages: [{
        role: 'user',
        content: `Synthesize these analysis results into a coherent summary:\n${
          JSON.stringify(results, null, 2)
        }`
      }]
    });
    
    return synthesis;
  }
} 