/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  EnterPlanModeTool,
  type EnterPlanModeParams,
} from './enterPlanMode.js';
import { ApprovalMode, type Config } from '../config/config.js';

describe('EnterPlanModeTool', () => {
  let tool: EnterPlanModeTool;
  let mockConfig: Config;
  let approvalMode: ApprovalMode;

  beforeEach(() => {
    approvalMode = ApprovalMode.DEFAULT;
    mockConfig = {
      getApprovalMode: vi.fn(() => approvalMode),
      setApprovalMode: vi.fn((mode: ApprovalMode) => {
        approvalMode = mode;
      }),
    } as unknown as Config;

    tool = new EnterPlanModeTool(mockConfig);
  });

  describe('constructor and metadata', () => {
    it('should have correct tool name', () => {
      expect(tool.name).toBe('enter_plan_mode');
      expect(EnterPlanModeTool.Name).toBe('enter_plan_mode');
    });

    it('should have correct display name', () => {
      expect(tool.displayName).toBe('EnterPlanMode');
    });

    it('should have correct kind', () => {
      expect(tool.kind).toBe('think');
    });

    it('should have correct schema', () => {
      expect(tool.schema).toEqual({
        name: 'enter_plan_mode',
        description: expect.stringContaining(
          'Use this tool when you encounter a complex task',
        ),
        parametersJsonSchema: {
          type: 'object',
          properties: {
            reason: {
              type: 'string',
              description: expect.stringContaining(
                'Brief explanation of why planning is needed',
              ),
            },
          },
          required: [],
          additionalProperties: false,
          $schema: 'http://json-schema.org/draft-07/schema#',
        },
      });
    });
  });

  describe('validateToolParams', () => {
    it('should accept valid parameters with reason', () => {
      const params: EnterPlanModeParams = {
        reason: 'This task requires architectural decisions.',
      };

      const result = tool.validateToolParams(params);
      expect(result).toBeNull();
    });

    it('should accept empty parameters (reason is optional)', () => {
      const params: EnterPlanModeParams = {};

      const result = tool.validateToolParams(params);
      expect(result).toBeNull();
    });

    it('should accept undefined reason', () => {
      const params: EnterPlanModeParams = {
        reason: undefined,
      };

      const result = tool.validateToolParams(params);
      expect(result).toBeNull();
    });
  });

  describe('tool execution', () => {
    it('should execute successfully and set approval mode to PLAN', async () => {
      const params: EnterPlanModeParams = {
        reason: 'Multiple architectural approaches possible',
      };
      const signal = new AbortController().signal;

      const invocation = tool.build(params);
      expect(invocation).toBeDefined();
      expect(invocation.params).toEqual(params);

      const result = await invocation.execute(signal);

      expect(result.llmContent).toContain('Plan mode activated');
      expect(result.llmContent).toContain(
        'Multiple architectural approaches possible',
      );
      expect(result.llmContent).toContain('Only use read-only tools');
      expect(result.llmContent).toContain('exit_plan_mode');
      expect(result.returnDisplay).toBe(
        'Entering plan mode: Multiple architectural approaches possible',
      );

      expect(mockConfig.setApprovalMode).toHaveBeenCalledWith(
        ApprovalMode.PLAN,
      );
      expect(approvalMode).toBe(ApprovalMode.PLAN);
    });

    it('should execute successfully without reason', async () => {
      const params: EnterPlanModeParams = {};
      const signal = new AbortController().signal;

      const invocation = tool.build(params);
      const result = await invocation.execute(signal);

      expect(result.llmContent).toContain('Plan mode activated');
      expect(result.llmContent).not.toContain('Reason:');
      expect(result.returnDisplay).toBe('Entering plan mode');

      expect(mockConfig.setApprovalMode).toHaveBeenCalledWith(
        ApprovalMode.PLAN,
      );
    });

    it('should have correct description', () => {
      const params: EnterPlanModeParams = {
        reason: 'Test reason',
      };

      const invocation = tool.build(params);
      expect(invocation.getDescription()).toBe(
        'Enter planning mode for complex task analysis',
      );
    });

    it('should return empty tool locations', () => {
      const params: EnterPlanModeParams = {};

      const invocation = tool.build(params);
      expect(invocation.toolLocations()).toEqual([]);
    });

    it('should not require confirmation', async () => {
      const params: EnterPlanModeParams = {
        reason: 'Planning needed',
      };
      const signal = new AbortController().signal;

      const invocation = tool.build(params);
      const confirmation = await invocation.shouldConfirmExecute(signal);

      // EnterPlanMode should not require confirmation (returns false or falsy)
      expect(confirmation).toBeFalsy();
    });
  });

  describe('tool description', () => {
    it('should contain when to use guidelines', () => {
      expect(tool.description).toContain('Multiple Valid Approaches');
      expect(tool.description).toContain('Significant Architectural Decisions');
      expect(tool.description).toContain('Large-Scale Changes');
      expect(tool.description).toContain('Unclear Requirements');
    });

    it('should contain when NOT to use guidelines', () => {
      expect(tool.description).toContain('When NOT to Use This Tool');
      expect(tool.description).toContain('Simple, straightforward tasks');
      expect(tool.description).toContain('Small bug fixes');
    });

    it('should contain examples', () => {
      expect(tool.description).toContain('Add caching to the API');
      expect(tool.description).toContain('WebSockets vs SSE vs polling');
      expect(tool.description).toContain('Refactor the authentication system');
    });

    it('should explain what happens in plan mode', () => {
      expect(tool.description).toContain('What Happens in Plan Mode');
      expect(tool.description).toContain('Thoroughly explore the codebase');
      expect(tool.description).toContain('exit_plan_mode tool');
    });
  });

  describe('error handling', () => {
    it('should handle setApprovalMode errors gracefully', async () => {
      const errorConfig = {
        getApprovalMode: vi.fn(() => ApprovalMode.DEFAULT),
        setApprovalMode: vi.fn(() => {
          throw new Error('Config is read-only');
        }),
      } as unknown as Config;

      const errorTool = new EnterPlanModeTool(errorConfig);
      const params: EnterPlanModeParams = {
        reason: 'Test',
      };
      const signal = new AbortController().signal;

      const invocation = errorTool.build(params);
      const result = await invocation.execute(signal);

      expect(result.llmContent).toContain('Failed to enter plan mode');
      expect(result.llmContent).toContain('Config is read-only');
      expect(result.returnDisplay).toContain('Error entering plan mode');
    });
  });

  describe('idempotency', () => {
    it('should work correctly when already in plan mode', async () => {
      // Start in plan mode
      approvalMode = ApprovalMode.PLAN;

      const params: EnterPlanModeParams = {
        reason: 'Re-entering plan mode',
      };
      const signal = new AbortController().signal;

      const invocation = tool.build(params);
      const result = await invocation.execute(signal);

      // Should still succeed (idempotent operation)
      expect(result.llmContent).toContain('Plan mode activated');
      expect(mockConfig.setApprovalMode).toHaveBeenCalledWith(
        ApprovalMode.PLAN,
      );
    });
  });
});
