# UI Contexts Architecture

This directory contains React contexts that manage UI state for the Dial Code CLI application.

## Context Hierarchy

```
AppContainer
├── ConfigContext              # Configuration and settings
├── SettingsContext           # User preferences
├── SessionContext            # Session lifecycle
├── StreamingContext          # API streaming state
├── KeypressContext           # Keyboard input handling
├── VimModeContext            # Vim keybinding mode
├── ShellFocusContext         # Embedded shell focus
├── OverflowContext           # Content overflow management
├── UIStateContext            # Unified UI state (legacy facade)
├── UIActionsContext          # UI action handlers
└── state/                    # Domain-specific state slices
    ├── DialogStateContext    # Dialog visibility flags
    ├── StreamingStateContext # Loading/streaming indicators
    ├── HistoryStateContext   # Conversation history
    ├── SessionStateContext   # Session preferences
    ├── TerminalStateContext  # Terminal dimensions
    └── AuthStateContext      # Authentication state
```

## Context Categories

### 1. Core Application Contexts

| Context           | Purpose                        | Key Exports                     |
| ----------------- | ------------------------------ | ------------------------------- |
| `ConfigContext`   | Global configuration values    | `useConfig()`                   |
| `SettingsContext` | User settings with persistence | `useSettings()`, `useSetting()` |
| `SessionContext`  | Session lifecycle & stats      | `useSession()`                  |
| `AppContext`      | Application-wide utilities     | `useApp()`                      |

### 2. UI State Contexts

| Context            | Purpose                           | Key Exports      |
| ------------------ | --------------------------------- | ---------------- |
| `UIStateContext`   | Unified UI state (156 properties) | `useUIState()`   |
| `UIActionsContext` | UI action dispatchers             | `useUIActions()` |

### 3. Domain-Specific State Slices

These contexts decompose `UIState` into focused domains to reduce re-renders:

| Slice                   | Properties | Domain                                         |
| ----------------------- | ---------- | ---------------------------------------------- |
| `DialogStateContext`    | 15         | Dialog visibility flags, confirmation requests |
| `StreamingStateContext` | 8          | Streaming, loading, processing states          |
| `HistoryStateContext`   | 10         | History items, pending messages, queues        |
| `SessionStateContext`   | 5          | Session stats, shell mode, user mode           |
| `TerminalStateContext`  | 8          | Terminal dimensions, layout calculations       |
| `AuthStateContext`      | 6          | Auth state, errors, Qwen OAuth                 |

### 4. Feature-Specific Contexts

| Context             | Purpose                    | Key Exports       |
| ------------------- | -------------------------- | ----------------- |
| `StreamingContext`  | API streaming management   | `useStreaming()`  |
| `KeypressContext`   | Keyboard event handling    | `useKeypress()`   |
| `VimModeContext`    | Vim keybinding state       | `useVimMode()`    |
| `ShellFocusContext` | Embedded shell focus       | `useShellFocus()` |
| `OverflowContext`   | Content overflow detection | `useOverflow()`   |

## State Slice Pattern

Each state slice follows a consistent pattern:

```typescript
// 1. State interface
interface FooState {
  value: string;
  isActive: boolean;
}

// 2. Actions interface
interface FooActions {
  setValue: (value: string) => void;
  setActive: (active: boolean) => void;
  reset: () => void;
}

// 3. Combined context value
interface FooContextValue {
  state: FooState;
  actions: FooActions;
}

// 4. Provider component
export function FooProvider({ children }: PropsWithChildren): React.ReactElement {
  const [state, dispatch] = useReducer(reducer, initialState);

  const actions = useMemo<FooActions>(() => ({
    setValue: (value) => dispatch({ type: 'SET_VALUE', payload: value }),
    setActive: (active) => dispatch({ type: 'SET_ACTIVE', payload: active }),
    reset: () => dispatch({ type: 'RESET' }),
  }), []);

  const contextValue = useMemo(() => ({ state, actions }), [state, actions]);

  return (
    <FooContext.Provider value={contextValue}>
      {children}
    </FooContext.Provider>
  );
}

// 5. Consumer hooks
export function useFooState(): FooState {
  const context = useContext(FooContext);
  if (!context) throw new Error('useFooState must be used within FooProvider');
  return context.state;
}

export function useFooActions(): FooActions {
  const context = useContext(FooContext);
  if (!context) throw new Error('useFooActions must be used within FooProvider');
  return context.actions;
}

// 6. Derived state hooks (for computed values)
export function useIsFooActive(): boolean {
  const { isActive } = useFooState();
  return isActive;
}
```

## Hook Usage Guidelines

### Reading State

```tsx
// Use specific state hooks when you only need certain properties
import { useDialogState } from './contexts/state';

function MyComponent() {
  const { isThemeDialogOpen } = useDialogState();
  // Component only re-renders when dialog state changes
}
```

### Dispatching Actions

```tsx
// Use action hooks when you only need to dispatch actions
import { useDialogActions } from './contexts/state';

function OpenButton() {
  const { setThemeDialogOpen } = useDialogActions();
  // Actions are stable references, won't cause re-renders

  return <button onClick={() => setThemeDialogOpen(true)}>Open</button>;
}
```

### Derived State Hooks

```tsx
// Use derived hooks for common computed values
import { useIsProcessing, useAnyDialogOpen } from './contexts/state';

function Header() {
  const isProcessing = useIsProcessing();
  const dialogOpen = useAnyDialogOpen();
  // Optimized subscriptions for specific boolean checks
}
```

### Legacy UIState Usage

```tsx
// UIState is still available for backwards compatibility
import { useUIState } from './UIStateContext';

function LegacyComponent() {
  const uiState = useUIState();
  // Full state object - re-renders on any state change
  // Prefer domain slices for new code
}
```

## State Update Patterns

### Action-Based Updates

All state changes should go through action functions:

```tsx
// Good: Using action functions
const { setThemeDialogOpen } = useDialogActions();
setThemeDialogOpen(true);

// Avoid: Direct state manipulation (not possible with this pattern)
```

### Batch Updates

React automatically batches state updates in event handlers:

```tsx
function handleSubmit() {
  setLoading(true);
  setError(null);
  setData(response);
  // All three updates batched into single render
}
```

For updates outside event handlers, use the render batcher:

```tsx
import { createRenderBatcher } from '../utils/performanceMonitor';

const batcher = createRenderBatcher();
batcher.schedule(() => setState1(value1));
batcher.schedule(() => setState2(value2));
```

### State Dependencies

When state depends on previous state, use functional updates:

```tsx
// In reducer
case 'INCREMENT':
  return { ...state, count: state.count + 1 };

// Not from stale closures
```

## Testing Patterns

### Mocking Contexts in Tests

```tsx
import { render } from 'ink-testing-library';
import { UIStateContext, UIActionsContext } from './UIStateContext';

function createMockUIState(overrides = {}) {
  return {
    history: [],
    isThemeDialogOpen: false,
    streamingState: 'Idle',
    // ... other required fields
    ...overrides,
  };
}

function createMockUIActions() {
  return {
    handleThemeSelect: vi.fn(),
    handleAuthSelect: vi.fn(),
    // ... other actions
  };
}

function renderWithUIContext(component, { uiState, uiActions } = {}) {
  return render(
    <UIStateContext.Provider value={uiState ?? createMockUIState()}>
      <UIActionsContext.Provider value={uiActions ?? createMockUIActions()}>
        {component}
      </UIActionsContext.Provider>
    </UIStateContext.Provider>,
  );
}
```

### Testing State Slices

```tsx
import { DialogStateProvider, useDialogState, useDialogActions } from './state';

describe('DialogStateContext', () => {
  it('opens theme dialog', () => {
    function TestComponent() {
      const { isThemeDialogOpen } = useDialogState();
      const { setThemeDialogOpen } = useDialogActions();
      return (
        <>
          <Text>{isThemeDialogOpen ? 'open' : 'closed'}</Text>
          <Button onPress={() => setThemeDialogOpen(true)}>Open</Button>
        </>
      );
    }

    const { lastFrame } = render(
      <DialogStateProvider>
        <TestComponent />
      </DialogStateProvider>,
    );

    expect(lastFrame()).toContain('closed');
  });
});
```

### Testing with ink-testing-library

```tsx
import { render } from 'ink-testing-library';

describe('MyComponent', () => {
  it('renders correctly', () => {
    const { lastFrame } = render(<MyComponent />);
    expect(lastFrame()).toContain('Expected text');
  });

  it('responds to user input', async () => {
    const { stdin, lastFrame } = render(<MyComponent />);
    await stdin.write('\r'); // Simulate Enter key
    expect(lastFrame()).toContain('Updated state');
  });
});
```

## Migration Guide

### Moving from UIState to Domain Slices

1. **Identify the domain** of properties you're using:
   - Dialog flags → `useDialogState()`
   - Loading/streaming → `useStreamingState()`
   - History items → `useHistoryState()`
   - Terminal size → `useTerminalState()`
   - Auth state → `useAuthState()`

2. **Replace imports**:

   ```tsx
   // Before
   import { useUIState } from './contexts/UIStateContext';
   const { isThemeDialogOpen, history, terminalWidth } = useUIState();

   // After
   import {
     useDialogState,
     useHistoryState,
     useTerminalState,
   } from './contexts/state';
   const { isThemeDialogOpen } = useDialogState();
   const { history } = useHistoryState();
   const { terminalWidth } = useTerminalState();
   ```

3. **Use derived hooks** for common checks:

   ```tsx
   // Before
   const { streamingState, shellConfirmationRequest } = useUIState();
   const isProcessing =
     streamingState === 'Responding' ||
     streamingState === 'StreamingToolResult';

   // After
   const isProcessing = useIsProcessing();
   ```

## Performance Considerations

1. **Prefer domain slices** over UIState to minimize re-renders
2. **Use derived hooks** for computed boolean values
3. **Split components** that read different state domains
4. **Memoize callbacks** that close over state
5. **Profile with** `useRenderCounter` in development mode

## File Organization

```
contexts/
├── AppContext.tsx           # Application utilities
├── ConfigContext.tsx        # Configuration values
├── KeypressContext.tsx      # Keyboard handling
├── OverflowContext.tsx      # Content overflow
├── SessionContext.tsx       # Session lifecycle
├── SettingsContext.tsx      # User settings
├── ShellFocusContext.tsx    # Shell focus state
├── StreamingContext.tsx     # API streaming
├── UIActionsContext.tsx     # UI action dispatchers
├── UIStateContext.tsx       # Unified state (legacy)
├── VimModeContext.tsx       # Vim mode state
├── README.md                # This file
└── state/                   # Domain-specific slices
    ├── index.ts             # Re-exports all slices
    ├── AuthStateContext.tsx
    ├── DialogStateContext.tsx
    ├── HistoryStateContext.tsx
    ├── SessionStateContext.tsx
    ├── StreamingStateContext.tsx
    └── TerminalStateContext.tsx
```
