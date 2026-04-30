import { describe, it, expect } from 'vitest';

describe('Navis - JSON Schema', { timeout: 30000 }, () => {
  it('should enforce strict validation with additionalProperties: false', async () => {
    const { NAVIS_DECISION_SCHEMA } = await import('../orchestrator');
    
    expect(NAVIS_DECISION_SCHEMA).toBeDefined();
    expect(NAVIS_DECISION_SCHEMA.$name).toBe('navis_decision');
    expect(NAVIS_DECISION_SCHEMA.type).toBe('object');
    expect(NAVIS_DECISION_SCHEMA.required).toContain('current_state');
    expect(NAVIS_DECISION_SCHEMA.required).toContain('action');
    expect(NAVIS_DECISION_SCHEMA.additionalProperties).toBe(false);
  });

  it('should define all required action types', async () => {
    const { NAVIS_DECISION_SCHEMA } = await import('../orchestrator');
    
    const actions = NAVIS_DECISION_SCHEMA.properties.action.items.oneOf;
    const actionNames = actions.map((a: any) => Object.keys(a.properties)[0]);
    
    expect(actionNames).toContain('go_to_url');
    expect(actionNames).toContain('click_element');
    expect(actionNames).toContain('input_text');
    expect(actionNames).toContain('scroll_down');
    expect(actionNames).toContain('scroll_up');
    expect(actionNames).toContain('wait');
    expect(actionNames).toContain('extract_content');
    expect(actionNames).toContain('open_tab');
    expect(actionNames).toContain('switch_tab');
    expect(actionNames).toContain('close_tab');
    expect(actionNames).toContain('done');
    expect(actionNames).toHaveLength(11);
  });
});

describe('Navis - Tool Registration', () => {
  it('should create navis tool with correct metadata', async () => {
    const { createNavisTool } = await import('../tool');
    const mockClient = {} as any;
    
    const tool = createNavisTool(mockClient);
    
    expect(tool.name).toBe('navis');
    expect(tool.description).toContain('browser automation');
    expect(tool.parameters.required).toContain('task');
    expect(typeof tool.execute).toBe('function');
  });

  it('should accept optional parameters', async () => {
    const { createNavisTool } = await import('../tool');
    const mockClient = {} as any;
    
    const tool = createNavisTool(mockClient);
    const props = tool.parameters.properties;
    
    expect(props.task.type).toBe('string');
    expect(props.maxSteps.type).toBe('number');
    expect(props.headless.type).toBe('boolean');
    expect(props.startUrl.type).toBe('string');
  });
});

describe('Navis - BrowserSession', () => {
  it('should export BrowserSession class', async () => {
    const { BrowserSession } = await import('../session');
    expect(BrowserSession).toBeDefined();
  });

  it('should have required methods', async () => {
    const { BrowserSession } = await import('../session');
    const session = new BrowserSession();
    
    expect(typeof session.launch).toBe('function');
    expect(typeof session.openTab).toBe('function');
    expect(typeof session.closeTab).toBe('function');
    expect(typeof session.switchToTab).toBe('function');
    expect(typeof session.getTabs).toBe('function');
    expect(typeof session.close).toBe('function');
  });
});

describe('Navis - ElementCapture', () => {
  it('should export capture functions', async () => {
    const { captureInteractiveElements, formatElementsForPrompt } = await import('../element-capture');
    
    expect(captureInteractiveElements).toBeDefined();
    expect(formatElementsForPrompt).toBeDefined();
  });

  it('should format elements in NAVIS.md format', async () => {
    const { formatElementsForPrompt } = await import('../element-capture');
    
    const elements = [
      { index: 0, tag: 'button', role: 'button', text: 'Submit', selector: 'button', visible: true, x: 0, y: 0, width: 100, height: 30, isInteractive: true },
      { index: 1, tag: 'h1', role: '', text: 'Welcome', selector: 'h1', visible: true, x: 0, y: 0, width: 200, height: 40, isInteractive: false },
    ];
    
    const formatted = formatElementsForPrompt(elements as any);
    expect(formatted).toContain('[0]<button>Submit</button>');
    expect(formatted).toContain('[]<h1>Welcome</h1>');
  });
});

describe('Navis - ActionExecutor', () => {
  it('should export executeAction function', async () => {
    const { executeAction } = await import('../actions');
    expect(executeAction).toBeDefined();
  });

  it('should handle unknown action gracefully', async () => {
    const { executeAction } = await import('../actions');
    
    const result = await executeAction(
      'unknown_action' as any,
      {},
      null as any,
      null as any,
      [],
    );
    
    expect(result.success).toBe(false);
    expect(result.message).toContain('Unknown action');
  });
});