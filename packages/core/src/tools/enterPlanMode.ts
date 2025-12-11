/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ToolResult } from './tools.js';
import { BaseDeclarativeTool, BaseToolInvocation, Kind } from './tools.js';
import type { FunctionDeclaration } from '@google/genai';
import type { Config } from '../config/config.js';
import { ApprovalMode } from '../config/config.js';
import { ToolDisplayNames, ToolNames } from './tool-names.js';

export interface EnterPlanModeParams {
  reason?: string;
}

const enterPlanModeToolDescription = `Use this tool when you encounter a complex task that requires careful planning and exploration before implementation. This tool transitions you into plan mode where you can thoroughly explore the codebase and design an implementation approach.

## When to Use This Tool

Use EnterPlanMode when ANY of these conditions apply:

1. **Multiple Valid Approaches**: The task can be solved in several different ways, each with trade-offs
   - Example: "Add caching to the API" - could use Redis, in-memory, file-based, etc.
   - Example: "Improve performance" - many optimization strategies possible

2. **Significant Architectural Decisions**: The task requires choosing between architectural patterns
   - Example: "Add real-time updates" - WebSockets vs SSE vs polling
   - Example: "Implement state management" - Redux vs Context vs custom solution

3. **Large-Scale Changes**: The task touches many files or systems
   - Example: "Refactor the authentication system"
   - Example: "Migrate from REST to GraphQL"

4. **Unclear Requirements**: You need to explore before understanding the full scope
   - Example: "Make the app faster" - need to profile and identify bottlenecks
   - Example: "Fix the bug in checkout" - need to investigate root cause

## When NOT to Use This Tool

Do NOT use EnterPlanMode for:
- Simple, straightforward tasks with obvious implementation
- Small bug fixes where the solution is clear
- Adding a single function or small feature
- Tasks you're already confident how to implement
- Research-only tasks (use exploration tools directly instead)

## What Happens in Plan Mode

In plan mode, you'll:
1. Thoroughly explore the codebase using read-only tools (Grep, Glob, ReadFile)
2. Understand existing patterns and architecture
3. Design an implementation approach
4. Present your plan to the user for approval via exit_plan_mode tool
5. Only after approval can you start making changes
`;

const enterPlanModeToolSchemaData: FunctionDeclaration = {
  name: 'enter_plan_mode',
  description: enterPlanModeToolDescription,
  parametersJsonSchema: {
    type: 'object',
    properties: {
      reason: {
        type: 'string',
        description:
          'Brief explanation of why planning is needed for this task. Helps the user understand why you are entering plan mode.',
      },
    },
    required: [],
    additionalProperties: false,
    $schema: 'http://json-schema.org/draft-07/schema#',
  },
};

class EnterPlanModeToolInvocation extends BaseToolInvocation<
  EnterPlanModeParams,
  ToolResult
> {
  constructor(
    private readonly config: Config,
    params: EnterPlanModeParams,
  ) {
    super(params);
  }

  getDescription(): string {
    return 'Enter planning mode for complex task analysis';
  }

  async execute(_signal: AbortSignal): Promise<ToolResult> {
    const { reason } = this.params;

    try {
      // Set approval mode to PLAN
      this.config.setApprovalMode(ApprovalMode.PLAN);

      const reasonText = reason ? ` Reason: ${reason}` : '';
      const llmMessage = `Plan mode activated.${reasonText}

You are now in plan mode. In this mode:
- Only use read-only tools (grep_search, glob, read_file, list_directory)
- Explore the codebase thoroughly to understand the problem
- Design a comprehensive implementation approach
- When ready, present your plan using the exit_plan_mode tool
- Do NOT make any edits or run any tools that modify the system until the user approves your plan`;

      const displayMessage = reason
        ? `Entering plan mode: ${reason}`
        : 'Entering plan mode';

      return {
        llmContent: llmMessage,
        returnDisplay: displayMessage,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `[EnterPlanModeTool] Error entering plan mode: ${errorMessage}`,
      );

      return {
        llmContent: `Failed to enter plan mode: ${errorMessage}`,
        returnDisplay: `Error entering plan mode: ${errorMessage}`,
      };
    }
  }
}

export class EnterPlanModeTool extends BaseDeclarativeTool<
  EnterPlanModeParams,
  ToolResult
> {
  static readonly Name: string = ToolNames.ENTER_PLAN_MODE;

  constructor(private readonly config: Config) {
    super(
      EnterPlanModeTool.Name,
      ToolDisplayNames.ENTER_PLAN_MODE,
      enterPlanModeToolDescription,
      Kind.Think,
      enterPlanModeToolSchemaData.parametersJsonSchema as Record<
        string,
        unknown
      >,
    );
  }

  override validateToolParams(_params: EnterPlanModeParams): string | null {
    // All parameters are optional, no validation needed
    return null;
  }

  protected createInvocation(params: EnterPlanModeParams) {
    return new EnterPlanModeToolInvocation(this.config, params);
  }
}
