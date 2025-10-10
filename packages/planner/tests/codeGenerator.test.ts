import { CodeGenerator } from '../src/services/codeGenerator';
import { Intent } from '../src/services/intentAnalyzer';

describe('CodeGenerator', () => {
  let codeGenerator: CodeGenerator;

  beforeEach(() => {
    codeGenerator = new CodeGenerator();
  });

  describe('generate', () => {
    it('should generate CSV viewer for csv_viewer intent', () => {
      const intent: Intent = {
        type: 'csv_viewer',
        components: ['file-upload', 'table', 'search'],
        plan: {
          framework: 'react',
          features: ['csv-parsing', 'table-display', 'search'],
          libraries: ['papaparse']
        }
      };

      const { files } = codeGenerator.generate(intent);

      expect(files['package.json']).toBeDefined();
      expect(files['public/index.html']).toBeDefined();
      expect(files['src/index.js']).toBeDefined();
      expect(files['src/App.js']).toBeDefined();

      const packageJson = JSON.parse(files['package.json']);
      expect(packageJson.name).toBe('csv-viewer');
      expect(packageJson.dependencies).toHaveProperty('papaparse');
      expect(packageJson.dependencies).toHaveProperty('react');

      expect(files['src/App.js']).toContain('Papa.parse');
      expect(files['src/App.js']).toContain('CSV');
      expect(files['src/App.js']).toContain('handleFileUpload');
    });

    it('should generate todo app for todo_app intent', () => {
      const intent: Intent = {
        type: 'todo_app',
        components: ['input', 'list', 'checkbox'],
        plan: {
          framework: 'react',
          features: ['add-task', 'complete-task', 'delete-task'],
          libraries: []
        }
      };

      const { files } = codeGenerator.generate(intent);

      expect(files['package.json']).toBeDefined();
      expect(files['src/App.js']).toBeDefined();

      const packageJson = JSON.parse(files['package.json']);
      expect(packageJson.name).toBe('todo-app');

      expect(files['src/App.js']).toContain('Todo');
      expect(files['src/App.js']).toContain('localStorage');
      expect(files['src/App.js']).toContain('checkbox');
    });

    it('should generate markdown editor for markdown_editor intent', () => {
      const intent: Intent = {
        type: 'markdown_editor',
        components: ['textarea', 'preview-pane'],
        plan: {
          framework: 'react',
          features: ['markdown-parsing', 'live-preview'],
          libraries: ['marked']
        }
      };

      const { files } = codeGenerator.generate(intent);

      expect(files['package.json']).toBeDefined();
      expect(files['src/App.js']).toBeDefined();

      const packageJson = JSON.parse(files['package.json']);
      expect(packageJson.name).toBe('markdown-editor');
      expect(packageJson.dependencies).toHaveProperty('marked');

      expect(files['src/App.js']).toContain('marked');
      expect(files['src/App.js']).toContain('textarea');
      expect(files['src/App.js']).toContain('Preview');
    });

    it('should generate generic app for unknown intent type', () => {
      const intent: Intent = {
        type: 'unknown_type',
        components: [],
        plan: {
          framework: 'react',
          features: [],
          libraries: []
        }
      };

      const { files } = codeGenerator.generate(intent);

      expect(files['package.json']).toBeDefined();
      expect(files['src/App.js']).toBeDefined();

      const packageJson = JSON.parse(files['package.json']);
      expect(packageJson.name).toBe('generic-app');
      expect(packageJson.dependencies).toHaveProperty('react');
    });

    it('should use default case for unspecified intent type', () => {
      const intent: Intent = {
        type: '',
        components: [],
        plan: {
          features: []
        }
      };

      const { files } = codeGenerator.generate(intent);

      expect(files).toBeDefined();
      expect(files['package.json']).toBeDefined();
    });
  });

  describe('CSV Viewer Generation', () => {
    it('should include all required files for CSV viewer', () => {
      const intent: Intent = {
        type: 'csv_viewer',
        components: [],
        plan: { features: [] }
      };

      const { files } = codeGenerator.generate(intent);

      expect(files['package.json']).toBeDefined();
      expect(files['package.json']).toBeTruthy();
      expect(files['public/index.html']).toBeDefined();
      expect(files['src/index.js']).toBeDefined();
      expect(files['src/App.js']).toBeDefined();
    });

    it('should include search functionality in CSV viewer', () => {
      const intent: Intent = {
        type: 'csv_viewer',
        components: [],
        plan: { features: [] }
      };

      const { files } = codeGenerator.generate(intent);

      expect(files['src/App.js']).toContain('search');
      expect(files['src/App.js']).toContain('filter');
    });

    it('should include file upload in CSV viewer', () => {
      const intent: Intent = {
        type: 'csv_viewer',
        components: [],
        plan: { features: [] }
      };

      const { files } = codeGenerator.generate(intent);

      expect(files['src/App.js']).toContain('input');
      expect(files['src/App.js']).toContain('type="file"');
      expect(files['src/App.js']).toContain('accept=".csv"');
    });
  });

  describe('Todo App Generation', () => {
    it('should include task management features', () => {
      const intent: Intent = {
        type: 'todo_app',
        components: [],
        plan: { features: [] }
      };

      const { files } = codeGenerator.generate(intent);

      expect(files['src/App.js']).toContain('addTodo');
      expect(files['src/App.js']).toContain('deleteTodo');
      expect(files['src/App.js']).toContain('toggleTodo');
    });

    it('should include local storage persistence', () => {
      const intent: Intent = {
        type: 'todo_app',
        components: [],
        plan: { features: [] }
      };

      const { files } = codeGenerator.generate(intent);

      expect(files['src/App.js']).toContain('localStorage');
      expect(files['src/App.js']).toContain('getItem');
      expect(files['src/App.js']).toContain('setItem');
    });

    it('should generate valid React hooks structure', () => {
      const intent: Intent = {
        type: 'todo_app',
        components: [],
        plan: { features: [] }
      };

      const { files } = codeGenerator.generate(intent);

      expect(files['src/App.js']).toContain('useState');
      expect(files['src/App.js']).toContain('useEffect');
    });
  });

  describe('Markdown Editor Generation', () => {
    it('should include markdown parsing library', () => {
      const intent: Intent = {
        type: 'markdown_editor',
        components: [],
        plan: { features: [] }
      };

      const { files } = codeGenerator.generate(intent);

      const packageJson = JSON.parse(files['package.json']);
      expect(packageJson.dependencies).toHaveProperty('marked');
    });

    it('should include preview pane with dangerouslySetInnerHTML', () => {
      const intent: Intent = {
        type: 'markdown_editor',
        components: [],
        plan: { features: [] }
      };

      const { files } = codeGenerator.generate(intent);

      expect(files['src/App.js']).toContain('dangerouslySetInnerHTML');
      expect(files['src/App.js']).toContain('Preview');
    });

    it('should include textarea for editing', () => {
      const intent: Intent = {
        type: 'markdown_editor',
        components: [],
        plan: { features: [] }
      };

      const { files } = codeGenerator.generate(intent);

      expect(files['src/App.js']).toContain('textarea');
      expect(files['src/App.js']).toContain('value={markdown}');
    });

    it('should have split-pane layout', () => {
      const intent: Intent = {
        type: 'markdown_editor',
        components: [],
        plan: { features: [] }
      };

      const { files } = codeGenerator.generate(intent);

      expect(files['src/App.js']).toContain('flex');
      expect(files['src/App.js']).toContain('Editor');
      expect(files['src/App.js']).toContain('Preview');
    });
  });

  describe('Generic App Generation', () => {
    it('should have basic React structure', () => {
      const intent: Intent = {
        type: 'generic',
        components: [],
        plan: { features: [] }
      };

      const { files } = codeGenerator.generate(intent);

      expect(files['src/App.js']).toContain('function App()');
      expect(files['src/App.js']).toContain('export default App');
    });

    it('should include minimal dependencies', () => {
      const intent: Intent = {
        type: 'custom',
        components: [],
        plan: { features: [] }
      };

      const { files } = codeGenerator.generate(intent);

      const packageJson = JSON.parse(files['package.json']);
      expect(packageJson.dependencies).toHaveProperty('react');
      expect(packageJson.dependencies).toHaveProperty('react-dom');
      expect(packageJson.dependencies).toHaveProperty('react-scripts');
    });
  });

  describe('Package.json Structure', () => {
    it('should include standard scripts for all app types', () => {
      const appTypes: Intent['type'][] = ['csv_viewer', 'todo_app', 'markdown_editor', 'generic'];

      appTypes.forEach(type => {
        const intent: Intent = {
          type,
          components: [],
          plan: { features: [] }
        };

        const { files } = codeGenerator.generate(intent);
        const packageJson = JSON.parse(files['package.json']);

        expect(packageJson.scripts).toHaveProperty('start');
        expect(packageJson.scripts).toHaveProperty('build');
      });
    });

    it('should have valid semver versions', () => {
      const intent: Intent = {
        type: 'csv_viewer',
        components: [],
        plan: { features: [] }
      };

      const { files } = codeGenerator.generate(intent);
      const packageJson = JSON.parse(files['package.json']);

      Object.values(packageJson.dependencies).forEach((version: any) => {
        expect(version).toMatch(/^[\^~]?\d+\.\d+\.\d+/);
      });
    });
  });

  describe('HTML Structure', () => {
    it('should include proper DOCTYPE and meta tags', () => {
      const intent: Intent = {
        type: 'csv_viewer',
        components: [],
        plan: { features: [] }
      };

      const { files } = codeGenerator.generate(intent);

      expect(files['public/index.html']).toContain('<!DOCTYPE html>');
      expect(files['public/index.html']).toContain('<meta charset="utf-8"');
      expect(files['public/index.html']).toContain('<meta name="viewport"');
      expect(files['public/index.html']).toContain('<div id="root"></div>');
    });
  });

  describe('React Entry Point', () => {
    it('should use React 18 createRoot API', () => {
      const intent: Intent = {
        type: 'todo_app',
        components: [],
        plan: { features: [] }
      };

      const { files } = codeGenerator.generate(intent);

      expect(files['src/index.js']).toContain('ReactDOM.createRoot');
      expect(files['src/index.js']).toContain("document.getElementById('root')");
      expect(files['src/index.js']).toContain('root.render');
    });
  });
});
