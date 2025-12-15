export interface Intent {
  type: string;
  components: string[];
  plan: {
    framework?: string;
    features: string[];
    libraries?: string[];
  };
  metadata?: any;
}

// Define strategy interface for different app types
export interface IntentStrategy {
  canHandle(prompt: string): boolean;
  analyze(prompt: string): Intent;
}

export class CSVViewerStrategy implements IntentStrategy {
  canHandle(prompt: string): boolean {
    const lowerPrompt = prompt.toLowerCase();
    return lowerPrompt.includes('csv') && (lowerPrompt.includes('viewer') || lowerPrompt.includes('view'));
  }

  analyze(prompt: string): Intent {
    return {
      type: 'csv_viewer',
      components: ['file-upload', 'table', 'search'],
      plan: {
        framework: 'react',
        features: ['csv-parsing', 'table-display', 'search', 'file-upload'],
        libraries: ['papaparse']
      }
    };
  }
}

export class TodoAppStrategy implements IntentStrategy {
  canHandle(prompt: string): boolean {
    const lowerPrompt = prompt.toLowerCase();
    return lowerPrompt.includes('todo') || lowerPrompt.includes('task');
  }

  analyze(prompt: string): Intent {
    return {
      type: 'todo_app',
      components: ['input', 'list', 'checkbox', 'delete-button'],
      plan: {
        framework: 'react',
        features: ['add-task', 'complete-task', 'delete-task', 'local-storage'],
        libraries: []
      }
    };
  }
}

export class MarkdownEditorStrategy implements IntentStrategy {
  canHandle(prompt: string): boolean {
    const lowerPrompt = prompt.toLowerCase();
    return lowerPrompt.includes('markdown') && lowerPrompt.includes('editor');
  }

  analyze(prompt: string): Intent {
    return {
      type: 'markdown_editor',
      components: ['textarea', 'preview-pane'],
      plan: {
        framework: 'react',
        features: ['markdown-parsing', 'live-preview', 'syntax-highlighting'],
        libraries: ['marked', 'highlight.js']
      }
    };
  }
}

export class GenericAppStrategy implements IntentStrategy {
  canHandle(prompt: string): boolean {
    // This strategy handles anything, so always returns true
    return true;
  }

  analyze(prompt: string): Intent {
    return {
      type: 'generic_app',
      components: ['container', 'header'],
      plan: {
        framework: 'react',
        features: ['basic-ui'],
        libraries: []
      }
    };
  }
}

// Action inference interface
export interface ActionInference {
  canHandle(action: any, context: any): boolean;
  infer(action: any, context: any): any;
}

export class TableSortingInference implements ActionInference {
  canHandle(action: any, context: any): boolean {
    return action.action === 'click' && action.target === 'table-header';
  }

  infer(action: any, context: any): any {
    return {
      id: 'add-sorting',
      type: 'feature',
      description: 'Add sorting functionality to table columns',
      confidence: 0.8,
      changes: {
        addSorting: true
      },
      autoApply: false
    };
  }
}

export class SearchEnhancementInference implements ActionInference {
  canHandle(action: any, context: any): boolean {
    return action.action === 'search' && context.currentCode;
  }

  infer(action: any, context: any): any {
    return {
      id: 'improve-search',
      type: 'improvement',
      description: 'Enhance search with fuzzy matching',
      confidence: 0.6,
      changes: {
        enhanceSearch: true
      },
      autoApply: false
    };
  }
}