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

export class IntentAnalyzer {
  analyze(prompt: string, context?: any): Intent {
    const lowerPrompt = prompt.toLowerCase();
    
    // CSV Viewer detection
    if (lowerPrompt.includes('csv') && (lowerPrompt.includes('viewer') || lowerPrompt.includes('view'))) {
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

    // Todo list detection
    if (lowerPrompt.includes('todo') || lowerPrompt.includes('task')) {
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

    // Markdown editor detection
    if (lowerPrompt.includes('markdown') && lowerPrompt.includes('editor')) {
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

    // Generic web app
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

  inferFromAction(action: any, context: any, history?: any[]): any[] {
    const suggestions: any[] = [];

    // Simple inference rules
    if (action.action === 'click' && action.target === 'table-header') {
      suggestions.push({
        id: 'add-sorting',
        type: 'feature',
        description: 'Add sorting functionality to table columns',
        confidence: 0.8,
        changes: {
          addSorting: true
        },
        autoApply: false
      });
    }

    if (action.action === 'search' && context.currentCode) {
      suggestions.push({
        id: 'improve-search',
        type: 'improvement',
        description: 'Enhance search with fuzzy matching',
        confidence: 0.6,
        changes: {
          enhanceSearch: true
        },
        autoApply: false
      });
    }

    return suggestions;
  }
}
