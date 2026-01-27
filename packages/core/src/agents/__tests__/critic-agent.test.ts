/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CriticAgent } from '../critic-agent.js';
import type {
  AgentLLMConfig,
  CriticContext,
  AntithesisOutput,
  ThesisOutput,
} from '../types.js';
import type { LLMClient } from '../../llm/llm-client.js';
import type { LLMCompletion, CompletionOptions } from '../../llm/types.js';

// Mock LLM client factory
function createMockLLMClient(
  responses: string[],
): LLMClient & { complete: ReturnType<typeof vi.fn> } {
  let callIndex = 0;
  return {
    complete: vi.fn(
      async (_options: CompletionOptions): Promise<LLMCompletion> => {
        const content = responses[callIndex] || responses[responses.length - 1];
        callIndex++;
        return {
          id: 'mock-id',
          content,
          finishReason: 'stop',
          model: 'mock-model',
          usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
        };
      },
    ),
  } as unknown as LLMClient & { complete: ReturnType<typeof vi.fn> };
}

// Valid thesis for critic context
function createValidThesis(): ThesisOutput {
  return {
    analysis: 'Implement user authentication with JWT',
    approach: 'Create login endpoint with token generation',
    plan: ['Create handler', 'Add JWT logic'],
    patches: [
      {
        file: 'src/auth.ts',
        action: 'edit',
        location: 'login function',
        description: 'Add JWT',
        code: 'jwt.sign(user)',
      },
    ],
    risks: ['Token expiration handling'],
  };
}

// Valid critic context
function createValidContext(): CriticContext {
  return {
    task: {
      id: 'task-1',
      description: 'Review authentication implementation',
      originalPrompt: 'Check the login code',
    },
    sessionId: 'session-1',
    round: 1,
    relevantFiles: [],
    thesis: createValidThesis(),
    projectDecisions: [],
    failurePatterns: [],
  };
}

// Valid antithesis output
function createValidAntithesisOutput(): AntithesisOutput {
  return {
    overallAssessment: 'acceptable',
    strengths: ['Good use of JWT', 'Clear implementation'],
    issues: [
      {
        severity: 'medium',
        category: 'security',
        description: 'Missing token expiration',
        location: 'jwt.sign call',
        suggestion: 'Add expiresIn option',
      },
    ],
    missingConsiderations: ['Error handling for invalid tokens'],
    questions: ['What should happen on token refresh?'],
  };
}

describe('CriticAgent', () => {
  let config: AgentLLMConfig;

  beforeEach(() => {
    config = {
      llm: 'test',
      temperature: 0.3,
      responseFormat: 'json',
    };
  });

  describe('constructor', () => {
    it('should create agent with correct role and display name', () => {
      const agent = new CriticAgent(config);
      expect(agent.role).toBe('critic');
      expect(agent.displayName).toBe('Reviewer');
    });
  });

  describe('generate', () => {
    it('should generate valid antithesis output', async () => {
      const agent = new CriticAgent(config);
      const output = createValidAntithesisOutput();
      agent.setLLMClient(createMockLLMClient([JSON.stringify(output)]));

      const result = await agent.generate(createValidContext());

      expect(result.overallAssessment).toBe('acceptable');
      expect(result.strengths).toHaveLength(2);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].severity).toBe('medium');
    });

    it('should handle context with failure patterns', async () => {
      const agent = new CriticAgent(config);
      const output = createValidAntithesisOutput();
      const client = createMockLLMClient([JSON.stringify(output)]);
      agent.setLLMClient(client);

      const context = createValidContext();
      context.failurePatterns = [
        {
          id: 'failure-1',
          scope: 'project',
          type: 'anti_pattern',
          summary: 'Unhandled promise rejection',
          reasoning: 'Occurred 5 times',
          source: { sessionId: 'session-1', date: '2024-01-01' },
          metadata: { confidence: 'high', timesReferenced: 5 },
        },
      ];

      await agent.generate(context);

      const userMessage = client.complete.mock.calls[0][0].messages.find(
        (m: { role: string }) => m.role === 'user',
      );
      expect(userMessage.content).toContain('Failure Patterns');
    });

    it('should include thesis in context', async () => {
      const agent = new CriticAgent(config);
      const output = createValidAntithesisOutput();
      const client = createMockLLMClient([JSON.stringify(output)]);
      agent.setLLMClient(client);

      await agent.generate(createValidContext());

      const userMessage = client.complete.mock.calls[0][0].messages.find(
        (m: { role: string }) => m.role === 'user',
      );
      expect(userMessage.content).toContain('Thesis');
      expect(userMessage.content).toContain('Implement user authentication');
    });
  });

  describe('validation - overall assessment', () => {
    it('should accept brief assessment', async () => {
      const agent = new CriticAgent(config);
      const output = createValidAntithesisOutput();
      output.overallAssessment = 'brief';
      agent.setLLMClient(createMockLLMClient([JSON.stringify(output)]));

      const result = await agent.generate(createValidContext());
      expect(result.overallAssessment).toBe('brief');
    });

    it('should accept concerning assessment', async () => {
      const agent = new CriticAgent(config);
      const output = createValidAntithesisOutput();
      output.overallAssessment = 'concerning';
      agent.setLLMClient(createMockLLMClient([JSON.stringify(output)]));

      const result = await agent.generate(createValidContext());
      expect(result.overallAssessment).toBe('concerning');
    });

    it('should accept critical assessment', async () => {
      const agent = new CriticAgent(config);
      const output = createValidAntithesisOutput();
      output.overallAssessment = 'critical';
      agent.setLLMClient(createMockLLMClient([JSON.stringify(output)]));

      const result = await agent.generate(createValidContext());
      expect(result.overallAssessment).toBe('critical');
    });

    it('should reject invalid assessment', async () => {
      const agent = new CriticAgent(config);
      const output = {
        ...createValidAntithesisOutput(),
        overallAssessment: 'invalid',
      };
      agent.setLLMClient(createMockLLMClient([JSON.stringify(output)]));

      await expect(agent.generate(createValidContext())).rejects.toThrow(
        /overallAssessment must be one of/i,
      );
    });
  });

  describe('validation - issues', () => {
    it('should accept all valid severities', async () => {
      const severities = ['low', 'medium', 'high', 'critical'] as const;

      for (const severity of severities) {
        const agent = new CriticAgent(config);
        const output = createValidAntithesisOutput();
        output.issues[0].severity = severity;
        agent.setLLMClient(createMockLLMClient([JSON.stringify(output)]));

        const result = await agent.generate(createValidContext());
        expect(result.issues[0].severity).toBe(severity);
      }
    });

    it('should accept all valid categories', async () => {
      const categories = [
        'correctness',
        'security',
        'performance',
        'maintainability',
        'edge_case',
      ] as const;

      for (const category of categories) {
        const agent = new CriticAgent(config);
        const output = createValidAntithesisOutput();
        output.issues[0].category = category;
        agent.setLLMClient(createMockLLMClient([JSON.stringify(output)]));

        const result = await agent.generate(createValidContext());
        expect(result.issues[0].category).toBe(category);
      }
    });

    it('should reject invalid severity', async () => {
      const agent = new CriticAgent(config);
      const output = createValidAntithesisOutput();
      output.issues[0].severity = 'unknown' as 'low';
      agent.setLLMClient(createMockLLMClient([JSON.stringify(output)]));

      await expect(agent.generate(createValidContext())).rejects.toThrow(
        /severity must be one of/i,
      );
    });

    it('should reject invalid category', async () => {
      const agent = new CriticAgent(config);
      const output = createValidAntithesisOutput();
      output.issues[0].category = 'unknown' as 'security';
      agent.setLLMClient(createMockLLMClient([JSON.stringify(output)]));

      await expect(agent.generate(createValidContext())).rejects.toThrow(
        /category must be one of/i,
      );
    });

    it('should reject issue with empty description', async () => {
      const agent = new CriticAgent(config);
      const output = createValidAntithesisOutput();
      output.issues[0].description = '';
      agent.setLLMClient(createMockLLMClient([JSON.stringify(output)]));

      await expect(agent.generate(createValidContext())).rejects.toThrow(
        /description must be a non-empty string/i,
      );
    });

    it('should handle multiple issues', async () => {
      const agent = new CriticAgent(config);
      const output = createValidAntithesisOutput();
      output.issues = [
        {
          severity: 'low',
          category: 'maintainability',
          description: 'Consider extracting to function',
          location: 'line 10',
          suggestion: 'Create helper',
        },
        {
          severity: 'high',
          category: 'security',
          description: 'Potential SQL injection',
          location: 'query',
          suggestion: 'Use parameterized query',
        },
        {
          severity: 'critical',
          category: 'correctness',
          description: 'Null pointer exception',
          location: 'line 50',
          suggestion: 'Add null check',
        },
      ];
      agent.setLLMClient(createMockLLMClient([JSON.stringify(output)]));

      const result = await agent.generate(createValidContext());
      expect(result.issues).toHaveLength(3);
    });
  });

  describe('validation - arrays', () => {
    it('should accept empty strengths array', async () => {
      const agent = new CriticAgent(config);
      const output = createValidAntithesisOutput();
      output.strengths = [];
      agent.setLLMClient(createMockLLMClient([JSON.stringify(output)]));

      const result = await agent.generate(createValidContext());
      expect(result.strengths).toHaveLength(0);
    });

    it('should accept empty issues array', async () => {
      const agent = new CriticAgent(config);
      const output = createValidAntithesisOutput();
      output.issues = [];
      agent.setLLMClient(createMockLLMClient([JSON.stringify(output)]));

      const result = await agent.generate(createValidContext());
      expect(result.issues).toHaveLength(0);
    });

    it('should reject non-array strengths', async () => {
      const agent = new CriticAgent(config);
      const output = {
        ...createValidAntithesisOutput(),
        strengths: 'not array',
      };
      agent.setLLMClient(createMockLLMClient([JSON.stringify(output)]));

      await expect(agent.generate(createValidContext())).rejects.toThrow(
        /strengths must be an array/i,
      );
    });

    it('should reject non-array issues', async () => {
      const agent = new CriticAgent(config);
      const output = { ...createValidAntithesisOutput(), issues: 'not array' };
      agent.setLLMClient(createMockLLMClient([JSON.stringify(output)]));

      await expect(agent.generate(createValidContext())).rejects.toThrow(
        /issues must be an array/i,
      );
    });
  });

  describe('token usage tracking', () => {
    it('should track token usage', async () => {
      const agent = new CriticAgent(config);
      const output = createValidAntithesisOutput();
      agent.setLLMClient(createMockLLMClient([JSON.stringify(output)]));

      await agent.generate(createValidContext());
      const usage = agent.getLastTokenUsage();

      expect(usage).not.toBeNull();
      expect(usage!.promptTokens).toBe(100);
      expect(usage!.completionTokens).toBe(200);
      expect(usage!.totalTokens).toBe(300);
    });
  });
});
