/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type React from 'react';
import { render } from 'ink-testing-library';
import { DialogManager } from './DialogManager.js';
import { UIStateContext, type UIState } from '../contexts/UIStateContext.js';
import { UIActionsContext } from '../contexts/UIActionsContext.js';
import { ConfigContext } from '../contexts/ConfigContext.js';
import { SettingsContext } from '../contexts/SettingsContext.js';
import type { UseHistoryManagerReturn } from '../hooks/useHistoryManager.js';
import type { Config } from '@dial-code/dial-core';
import { createMinimalSettings } from '../../config/settings.js';
import { ApprovalMode } from '@dial-code/dial-core';

// Import Text from ink for mocks
import { Text } from 'ink';

// Mock all dialog components to avoid complex dependencies
vi.mock('./WelcomeBackDialog.js', () => ({
  WelcomeBackDialog: () => <Text>[WelcomeBackDialog]</Text>,
}));

vi.mock('./IdeTrustChangeDialog.js', () => ({
  IdeTrustChangeDialog: () => <Text>[IdeTrustChangeDialog]</Text>,
}));

vi.mock('./WorkspaceMigrationDialog.js', () => ({
  WorkspaceMigrationDialog: () => <Text>[WorkspaceMigrationDialog]</Text>,
}));

vi.mock('./ProQuotaDialog.js', () => ({
  ProQuotaDialog: () => <Text>[ProQuotaDialog]</Text>,
}));

vi.mock('../IdeIntegrationNudge.js', () => ({
  IdeIntegrationNudge: () => <Text>[IdeIntegrationNudge]</Text>,
}));

vi.mock('./FolderTrustDialog.js', () => ({
  FolderTrustDialog: () => <Text>[FolderTrustDialog]</Text>,
}));

vi.mock('./ShellConfirmationDialog.js', () => ({
  ShellConfirmationDialog: () => <Text>[ShellConfirmationDialog]</Text>,
}));

vi.mock('./LoopDetectionConfirmation.js', () => ({
  LoopDetectionConfirmation: () => <Text>[LoopDetectionConfirmation]</Text>,
}));

vi.mock('./QuitConfirmationDialog.js', () => ({
  QuitConfirmationDialog: () => <Text>[QuitConfirmationDialog]</Text>,
  QuitChoice: {
    CANCEL: 'cancel',
    QUIT: 'quit',
    SAVE_AND_QUIT: 'save_and_quit',
    SUMMARY_AND_QUIT: 'summary_and_quit',
  },
}));

vi.mock('./ConsentPrompt.js', () => ({
  ConsentPrompt: () => <Text>[ConsentPrompt]</Text>,
}));

vi.mock('./ThemeDialog.js', () => ({
  ThemeDialog: () => <Text>[ThemeDialog]</Text>,
}));

vi.mock('./SettingsDialog.js', () => ({
  SettingsDialog: () => <Text>[SettingsDialog]</Text>,
}));

vi.mock('./ApprovalModeDialog.js', () => ({
  ApprovalModeDialog: () => <Text>[ApprovalModeDialog]</Text>,
}));

vi.mock('./ModelDialog.js', () => ({
  ModelDialog: () => <Text>[ModelDialog]</Text>,
}));

vi.mock('./ModelSwitchDialog.js', () => ({
  ModelSwitchDialog: () => <Text>[ModelSwitchDialog]</Text>,
}));

vi.mock('../auth/AuthDialog.js', () => ({
  AuthDialog: () => <Text>[AuthDialog]</Text>,
}));

vi.mock('./OpenAIKeyPrompt.js', () => ({
  OpenAIKeyPrompt: () => <Text>[OpenAIKeyPrompt]</Text>,
}));

vi.mock('./QwenOAuthProgress.js', () => ({
  QwenOAuthProgress: () => <Text>[QwenOAuthProgress]</Text>,
}));

vi.mock('./EditorSettingsDialog.js', () => ({
  EditorSettingsDialog: () => <Text>[EditorSettingsDialog]</Text>,
}));

vi.mock('./PermissionsModifyTrustDialog.js', () => ({
  PermissionsModifyTrustDialog: () => (
    <Text>[PermissionsModifyTrustDialog]</Text>
  ),
}));

vi.mock('./subagents/create/AgentCreationWizard.js', () => ({
  AgentCreationWizard: () => <Text>[AgentCreationWizard]</Text>,
}));

vi.mock('./subagents/manage/AgentsManagerDialog.js', () => ({
  AgentsManagerDialog: () => <Text>[AgentsManagerDialog]</Text>,
}));

// Helper to create minimal UI state
const createMinimalUIState = (overrides: Partial<UIState> = {}): UIState => ({
  history: [],
  historyManager: {} as UseHistoryManagerReturn,
  isThemeDialogOpen: false,
  themeError: null,
  isAuthenticating: false,
  isConfigInitialized: true,
  authError: null,
  isAuthDialogOpen: false,
  pendingAuthType: undefined,
  qwenAuthState: { deviceAuth: null, authStatus: 'idle', authMessage: null },
  editorError: null,
  isEditorDialogOpen: false,
  corgiMode: false,
  debugMessage: '',
  quittingMessages: null,
  isSettingsDialogOpen: false,
  isModelDialogOpen: false,
  isPermissionsDialogOpen: false,
  isApprovalModeDialogOpen: false,
  slashCommands: [],
  pendingSlashCommandHistoryItems: [],
  commandContext: {} as UIState['commandContext'],
  shellConfirmationRequest: null,
  confirmationRequest: null,
  confirmUpdateExtensionRequests: [],
  loopDetectionConfirmationRequest: null,
  quitConfirmationRequest: null,
  geminiMdFileCount: 0,
  streamingState: 'idle' as UIState['streamingState'],
  initError: null,
  pendingGeminiHistoryItems: [],
  thought: null,
  shellModeActive: false,
  userMessages: [],
  buffer: {} as UIState['buffer'],
  inputWidth: 80,
  suggestionsWidth: 80,
  isInputActive: true,
  shouldShowIdePrompt: false,
  isFolderTrustDialogOpen: false,
  isTrustedFolder: true,
  constrainHeight: false,
  showErrorDetails: false,
  filteredConsoleMessages: [],
  ideContextState: undefined,
  showToolDescriptions: false,
  ctrlCPressedOnce: false,
  ctrlDPressedOnce: false,
  showEscapePrompt: false,
  elapsedTime: 0,
  currentLoadingPhrase: '',
  historyRemountKey: 0,
  messageQueue: [],
  showAutoAcceptIndicator: 'default' as UIState['showAutoAcceptIndicator'],
  userMode: 'quick',
  userModeIsManual: false,
  userModeAutoInfo: null,
  showWorkspaceMigrationDialog: false,
  workspaceExtensions: [],
  userTier: undefined,
  proQuotaRequest: null,
  currentModel: 'test-model',
  contextFileNames: [],
  errorCount: 0,
  availableTerminalHeight: 24,
  mainAreaWidth: 80,
  staticAreaMaxItemHeight: 10,
  staticExtraHeight: 5,
  dialogsVisible: true,
  pendingHistoryItems: [],
  nightly: false,
  branchName: undefined,
  sessionStats: {} as UIState['sessionStats'],
  terminalWidth: 80,
  terminalHeight: 24,
  mainControlsRef: { current: null },
  currentIDE: null,
  updateInfo: null,
  showIdeRestartPrompt: false,
  ideTrustRestartReason: 'NONE',
  isRestarting: false,
  extensionsUpdateState: new Map(),
  activePtyId: undefined,
  embeddedShellFocused: false,
  isVisionSwitchDialogOpen: false,
  showWelcomeBackDialog: false,
  welcomeBackInfo: null,
  welcomeBackChoice: null,
  isSubagentCreateDialogOpen: false,
  isAgentsManagerDialogOpen: false,
  dialecticEvent: null,
  isDialecticActive: false,
  ...overrides,
});

// Helper to create minimal UI actions
const createMinimalUIActions = () => ({
  handleWelcomeBackSelection: vi.fn(),
  handleWelcomeBackClose: vi.fn(),
  onWorkspaceMigrationDialogOpen: vi.fn(),
  onWorkspaceMigrationDialogClose: vi.fn(),
  handleProQuotaChoice: vi.fn(),
  handleIdePromptComplete: vi.fn(),
  handleFolderTrustSelect: vi.fn(),
  handleThemeSelect: vi.fn(),
  handleThemeHighlight: vi.fn(),
  closeSettingsDialog: vi.fn(),
  handleApprovalModeSelect: vi.fn(),
  closeModelDialog: vi.fn(),
  handleVisionSwitchSelect: vi.fn(),
  handleAuthSelect: vi.fn(),
  onAuthError: vi.fn(),
  cancelAuthentication: vi.fn(),
  setAuthState: vi.fn(),
  handleEditorSelect: vi.fn(),
  exitEditorDialog: vi.fn(),
  closePermissionsDialog: vi.fn(),
  closeSubagentCreateDialog: vi.fn(),
  closeAgentsManagerDialog: vi.fn(),
});

// Helper to create minimal config
const createMinimalConfig = (): Partial<Config> => ({
  getApprovalMode: () => ApprovalMode.DEFAULT,
});

// Settings helper - just use the imported createMinimalSettings directly

// Wrapper component for providing contexts
interface TestWrapperProps {
  uiState: UIState;
  uiActions: ReturnType<typeof createMinimalUIActions>;
  config: Partial<Config>;
  settings: ReturnType<typeof createMinimalSettings>;
  children: React.ReactNode;
}

const TestWrapper: React.FC<TestWrapperProps> = ({
  uiState,
  uiActions,
  config,
  settings,
  children,
}) => (
  <UIStateContext.Provider value={uiState}>
    <UIActionsContext.Provider value={uiActions as never}>
      <ConfigContext.Provider value={config as Config}>
        <SettingsContext.Provider value={settings}>
          {children}
        </SettingsContext.Provider>
      </ConfigContext.Provider>
    </UIActionsContext.Provider>
  </UIStateContext.Provider>
);

describe('DialogManager', () => {
  const mockAddItem = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Dialog Priority', () => {
    it('shows WelcomeBackDialog with highest priority', () => {
      const uiState = createMinimalUIState({
        showWelcomeBackDialog: true,
        welcomeBackInfo: { hasHistory: true },
        isThemeDialogOpen: true, // Lower priority
      });

      const { lastFrame } = render(
        <TestWrapper
          uiState={uiState}
          uiActions={createMinimalUIActions()}
          config={createMinimalConfig()}
          settings={createMinimalSettings()}
        >
          <DialogManager addItem={mockAddItem} terminalWidth={80} />
        </TestWrapper>,
      );

      expect(lastFrame()).toContain('[WelcomeBackDialog]');
      expect(lastFrame()).not.toContain('[ThemeDialog]');
    });

    it('shows IdeRestartPrompt over other dialogs', () => {
      const uiState = createMinimalUIState({
        showIdeRestartPrompt: true,
        ideTrustRestartReason: 'TRUST_CHANGE',
        isSettingsDialogOpen: true, // Lower priority
      });

      const { lastFrame } = render(
        <TestWrapper
          uiState={uiState}
          uiActions={createMinimalUIActions()}
          config={createMinimalConfig()}
          settings={createMinimalSettings()}
        >
          <DialogManager addItem={mockAddItem} terminalWidth={80} />
        </TestWrapper>,
      );

      expect(lastFrame()).toContain('[IdeTrustChangeDialog]');
      expect(lastFrame()).not.toContain('[SettingsDialog]');
    });

    it('shows ProQuotaDialog over settings dialogs', () => {
      const uiState = createMinimalUIState({
        proQuotaRequest: {
          failedModel: 'model-a',
          fallbackModel: 'model-b',
          resolve: vi.fn(),
        },
        isSettingsDialogOpen: true,
      });

      const { lastFrame } = render(
        <TestWrapper
          uiState={uiState}
          uiActions={createMinimalUIActions()}
          config={createMinimalConfig()}
          settings={createMinimalSettings()}
        >
          <DialogManager addItem={mockAddItem} terminalWidth={80} />
        </TestWrapper>,
      );

      expect(lastFrame()).toContain('[ProQuotaDialog]');
      expect(lastFrame()).not.toContain('[SettingsDialog]');
    });

    it('shows only one dialog at a time', () => {
      const uiState = createMinimalUIState({
        isThemeDialogOpen: true,
        isSettingsDialogOpen: true,
        isModelDialogOpen: true,
      });

      const { lastFrame } = render(
        <TestWrapper
          uiState={uiState}
          uiActions={createMinimalUIActions()}
          config={createMinimalConfig()}
          settings={createMinimalSettings()}
        >
          <DialogManager addItem={mockAddItem} terminalWidth={80} />
        </TestWrapper>,
      );

      const frame = lastFrame() || '';
      // Count how many dialog markers appear
      const dialogMatches = frame.match(/\[[A-Za-z]+Dialog\]/g) || [];
      expect(dialogMatches.length).toBe(1);
    });
  });

  describe('Dialog Rendering', () => {
    it('renders ThemeDialog when isThemeDialogOpen=true', () => {
      const uiState = createMinimalUIState({
        isThemeDialogOpen: true,
      });

      const { lastFrame } = render(
        <TestWrapper
          uiState={uiState}
          uiActions={createMinimalUIActions()}
          config={createMinimalConfig()}
          settings={createMinimalSettings()}
        >
          <DialogManager addItem={mockAddItem} terminalWidth={80} />
        </TestWrapper>,
      );

      expect(lastFrame()).toContain('[ThemeDialog]');
    });

    it('renders SettingsDialog when isSettingsDialogOpen=true', () => {
      const uiState = createMinimalUIState({
        isSettingsDialogOpen: true,
      });

      const { lastFrame } = render(
        <TestWrapper
          uiState={uiState}
          uiActions={createMinimalUIActions()}
          config={createMinimalConfig()}
          settings={createMinimalSettings()}
        >
          <DialogManager addItem={mockAddItem} terminalWidth={80} />
        </TestWrapper>,
      );

      expect(lastFrame()).toContain('[SettingsDialog]');
    });

    it('renders ModelDialog when isModelDialogOpen=true', () => {
      const uiState = createMinimalUIState({
        isModelDialogOpen: true,
      });

      const { lastFrame } = render(
        <TestWrapper
          uiState={uiState}
          uiActions={createMinimalUIActions()}
          config={createMinimalConfig()}
          settings={createMinimalSettings()}
        >
          <DialogManager addItem={mockAddItem} terminalWidth={80} />
        </TestWrapper>,
      );

      expect(lastFrame()).toContain('[ModelDialog]');
    });

    it('renders ApprovalModeDialog when isApprovalModeDialogOpen=true', () => {
      const uiState = createMinimalUIState({
        isApprovalModeDialogOpen: true,
      });

      const { lastFrame } = render(
        <TestWrapper
          uiState={uiState}
          uiActions={createMinimalUIActions()}
          config={createMinimalConfig()}
          settings={createMinimalSettings()}
        >
          <DialogManager addItem={mockAddItem} terminalWidth={80} />
        </TestWrapper>,
      );

      expect(lastFrame()).toContain('[ApprovalModeDialog]');
    });

    it('renders AuthDialog when isAuthDialogOpen=true', () => {
      const uiState = createMinimalUIState({
        isAuthDialogOpen: true,
      });

      const { lastFrame } = render(
        <TestWrapper
          uiState={uiState}
          uiActions={createMinimalUIActions()}
          config={createMinimalConfig()}
          settings={createMinimalSettings()}
        >
          <DialogManager addItem={mockAddItem} terminalWidth={80} />
        </TestWrapper>,
      );

      expect(lastFrame()).toContain('[AuthDialog]');
    });

    it('renders EditorSettingsDialog when isEditorDialogOpen=true', () => {
      const uiState = createMinimalUIState({
        isEditorDialogOpen: true,
      });

      const { lastFrame } = render(
        <TestWrapper
          uiState={uiState}
          uiActions={createMinimalUIActions()}
          config={createMinimalConfig()}
          settings={createMinimalSettings()}
        >
          <DialogManager addItem={mockAddItem} terminalWidth={80} />
        </TestWrapper>,
      );

      expect(lastFrame()).toContain('[EditorSettingsDialog]');
    });

    it('renders PermissionsModifyTrustDialog when isPermissionsDialogOpen=true', () => {
      const uiState = createMinimalUIState({
        isPermissionsDialogOpen: true,
      });

      const { lastFrame } = render(
        <TestWrapper
          uiState={uiState}
          uiActions={createMinimalUIActions()}
          config={createMinimalConfig()}
          settings={createMinimalSettings()}
        >
          <DialogManager addItem={mockAddItem} terminalWidth={80} />
        </TestWrapper>,
      );

      expect(lastFrame()).toContain('[PermissionsModifyTrustDialog]');
    });

    it('renders FolderTrustDialog when isFolderTrustDialogOpen=true', () => {
      const uiState = createMinimalUIState({
        isFolderTrustDialogOpen: true,
      });

      const { lastFrame } = render(
        <TestWrapper
          uiState={uiState}
          uiActions={createMinimalUIActions()}
          config={createMinimalConfig()}
          settings={createMinimalSettings()}
        >
          <DialogManager addItem={mockAddItem} terminalWidth={80} />
        </TestWrapper>,
      );

      expect(lastFrame()).toContain('[FolderTrustDialog]');
    });

    it('renders VisionSwitchDialog when isVisionSwitchDialogOpen=true', () => {
      const uiState = createMinimalUIState({
        isVisionSwitchDialogOpen: true,
      });

      const { lastFrame } = render(
        <TestWrapper
          uiState={uiState}
          uiActions={createMinimalUIActions()}
          config={createMinimalConfig()}
          settings={createMinimalSettings()}
        >
          <DialogManager addItem={mockAddItem} terminalWidth={80} />
        </TestWrapper>,
      );

      expect(lastFrame()).toContain('[ModelSwitchDialog]');
    });

    it('renders AgentCreationWizard when isSubagentCreateDialogOpen=true', () => {
      const uiState = createMinimalUIState({
        isSubagentCreateDialogOpen: true,
      });

      const { lastFrame } = render(
        <TestWrapper
          uiState={uiState}
          uiActions={createMinimalUIActions()}
          config={createMinimalConfig()}
          settings={createMinimalSettings()}
        >
          <DialogManager addItem={mockAddItem} terminalWidth={80} />
        </TestWrapper>,
      );

      expect(lastFrame()).toContain('[AgentCreationWizard]');
    });

    it('renders AgentsManagerDialog when isAgentsManagerDialogOpen=true', () => {
      const uiState = createMinimalUIState({
        isAgentsManagerDialogOpen: true,
      });

      const { lastFrame } = render(
        <TestWrapper
          uiState={uiState}
          uiActions={createMinimalUIActions()}
          config={createMinimalConfig()}
          settings={createMinimalSettings()}
        >
          <DialogManager addItem={mockAddItem} terminalWidth={80} />
        </TestWrapper>,
      );

      expect(lastFrame()).toContain('[AgentsManagerDialog]');
    });

    it('returns null when no dialog is active', () => {
      const uiState = createMinimalUIState();

      const { lastFrame } = render(
        <TestWrapper
          uiState={uiState}
          uiActions={createMinimalUIActions()}
          config={createMinimalConfig()}
          settings={createMinimalSettings()}
        >
          <DialogManager addItem={mockAddItem} terminalWidth={80} />
        </TestWrapper>,
      );

      // Should be empty or just whitespace
      expect(lastFrame()?.trim()).toBe('');
    });
  });

  describe('Request Queues', () => {
    it('processes shellConfirmationRequest', () => {
      const uiState = createMinimalUIState({
        shellConfirmationRequest: {
          commands: ['rm -rf /'],
          onConfirm: vi.fn(),
        },
      });

      const { lastFrame } = render(
        <TestWrapper
          uiState={uiState}
          uiActions={createMinimalUIActions()}
          config={createMinimalConfig()}
          settings={createMinimalSettings()}
        >
          <DialogManager addItem={mockAddItem} terminalWidth={80} />
        </TestWrapper>,
      );

      expect(lastFrame()).toContain('[ShellConfirmationDialog]');
    });

    it('processes loopDetectionConfirmationRequest', () => {
      const uiState = createMinimalUIState({
        loopDetectionConfirmationRequest: {
          onComplete: vi.fn(),
        },
      });

      const { lastFrame } = render(
        <TestWrapper
          uiState={uiState}
          uiActions={createMinimalUIActions()}
          config={createMinimalConfig()}
          settings={createMinimalSettings()}
        >
          <DialogManager addItem={mockAddItem} terminalWidth={80} />
        </TestWrapper>,
      );

      expect(lastFrame()).toContain('[LoopDetectionConfirmation]');
    });

    it('processes quitConfirmationRequest', () => {
      const uiState = createMinimalUIState({
        quitConfirmationRequest: {
          onConfirm: vi.fn(),
        },
      });

      const { lastFrame } = render(
        <TestWrapper
          uiState={uiState}
          uiActions={createMinimalUIActions()}
          config={createMinimalConfig()}
          settings={createMinimalSettings()}
        >
          <DialogManager addItem={mockAddItem} terminalWidth={80} />
        </TestWrapper>,
      );

      expect(lastFrame()).toContain('[QuitConfirmationDialog]');
    });

    it('processes confirmationRequest', () => {
      const uiState = createMinimalUIState({
        confirmationRequest: {
          prompt: 'Are you sure?',
          onConfirm: vi.fn(),
        },
      });

      const { lastFrame } = render(
        <TestWrapper
          uiState={uiState}
          uiActions={createMinimalUIActions()}
          config={createMinimalConfig()}
          settings={createMinimalSettings()}
        >
          <DialogManager addItem={mockAddItem} terminalWidth={80} />
        </TestWrapper>,
      );

      expect(lastFrame()).toContain('[ConsentPrompt]');
    });

    it('processes confirmUpdateExtensionRequests in order', () => {
      const uiState = createMinimalUIState({
        confirmUpdateExtensionRequests: [
          { prompt: 'Update extension 1?', onConfirm: vi.fn() },
          { prompt: 'Update extension 2?', onConfirm: vi.fn() },
        ],
      });

      const { lastFrame } = render(
        <TestWrapper
          uiState={uiState}
          uiActions={createMinimalUIActions()}
          config={createMinimalConfig()}
          settings={createMinimalSettings()}
        >
          <DialogManager addItem={mockAddItem} terminalWidth={80} />
        </TestWrapper>,
      );

      // Should show the first request
      expect(lastFrame()).toContain('[ConsentPrompt]');
    });
  });

  describe('Error Display', () => {
    it('displays themeError when present', () => {
      const uiState = createMinimalUIState({
        isThemeDialogOpen: true,
        themeError: 'Theme error message',
      });

      const { lastFrame } = render(
        <TestWrapper
          uiState={uiState}
          uiActions={createMinimalUIActions()}
          config={createMinimalConfig()}
          settings={createMinimalSettings()}
        >
          <DialogManager addItem={mockAddItem} terminalWidth={80} />
        </TestWrapper>,
      );

      expect(lastFrame()).toContain('Theme error message');
    });

    it('displays editorError when present', () => {
      const uiState = createMinimalUIState({
        isEditorDialogOpen: true,
        editorError: 'Editor error message',
      });

      const { lastFrame } = render(
        <TestWrapper
          uiState={uiState}
          uiActions={createMinimalUIActions()}
          config={createMinimalConfig()}
          settings={createMinimalSettings()}
        >
          <DialogManager addItem={mockAddItem} terminalWidth={80} />
        </TestWrapper>,
      );

      expect(lastFrame()).toContain('Editor error message');
    });

    it('displays authError by showing AuthDialog', () => {
      const uiState = createMinimalUIState({
        authError: 'Authentication failed',
      });

      const { lastFrame } = render(
        <TestWrapper
          uiState={uiState}
          uiActions={createMinimalUIActions()}
          config={createMinimalConfig()}
          settings={createMinimalSettings()}
        >
          <DialogManager addItem={mockAddItem} terminalWidth={80} />
        </TestWrapper>,
      );

      expect(lastFrame()).toContain('[AuthDialog]');
    });
  });
});
