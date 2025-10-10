import { Intent } from './intentAnalyzer';

export class CodeGenerator {
  generate(intent: Intent): { files: Record<string, string> } {
    switch (intent.type) {
      case 'csv_viewer':
        return this.generateCSVViewer();
      case 'todo_app':
        return this.generateTodoApp();
      case 'markdown_editor':
        return this.generateMarkdownEditor();
      default:
        return this.generateGenericApp();
    }
  }

  private generateCSVViewer(): { files: Record<string, string> } {
    return {
      files: {
        'package.json': JSON.stringify({
          name: 'csv-viewer',
          version: '1.0.0',
          dependencies: {
            'react': '^18.2.0',
            'react-dom': '^18.2.0',
            'react-scripts': '5.0.1',
            'papaparse': '^5.4.1'
          },
          scripts: {
            'start': 'react-scripts start',
            'build': 'react-scripts build',
            'test': 'react-scripts test'
          },
          browserslist: {
            production: ['>0.2%', 'not dead', 'not op_mini all'],
            development: ['last 1 chrome version', 'last 1 firefox version', 'last 1 safari version']
          }
        }, null, 2),
        'public/index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>CSV Viewer</title>
</head>
<body>
  <div id="root"></div>
</body>
</html>`,
        'src/index.js': `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);`,
        'src/App.js': `import React, { useState } from 'react';
import Papa from 'papaparse';

function App() {
  const [data, setData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [search, setSearch] = useState('');

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      Papa.parse(file, {
        header: true,
        complete: (results) => {
          if (results.data.length > 0) {
            setHeaders(Object.keys(results.data[0]));
            setData(results.data);
          }
        }
      });
    }
  };

  const filteredData = data.filter(row =>
    Object.values(row).some(val =>
      String(val).toLowerCase().includes(search.toLowerCase())
    )
  );

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>CSV Viewer</h1>
      <div style={{ marginBottom: '20px' }}>
        <input
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          style={{ marginRight: '10px' }}
        />
        {data.length > 0 && (
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: '5px', width: '200px' }}
          />
        )}
      </div>
      {filteredData.length > 0 && (
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse',
          border: '1px solid #ddd'
        }}>
          <thead>
            <tr style={{ backgroundColor: '#f2f2f2' }}>
              {headers.map((header, i) => (
                <th key={i} style={{ 
                  border: '1px solid #ddd',
                  padding: '8px',
                  textAlign: 'left'
                }}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredData.map((row, i) => (
              <tr key={i}>
                {headers.map((header, j) => (
                  <td key={j} style={{ 
                    border: '1px solid #ddd',
                    padding: '8px'
                  }}>
                    {row[header]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {data.length === 0 && <p>Upload a CSV file to view its contents</p>}
    </div>
  );
}

export default App;`
      }
    };
  }

  private generateTodoApp(): { files: Record<string, string> } {
    return {
      files: {
        'package.json': JSON.stringify({
          name: 'todo-app',
          version: '1.0.0',
          dependencies: {
            'react': '^18.2.0',
            'react-dom': '^18.2.0',
            'react-scripts': '5.0.1'
          },
          scripts: {
            'start': 'react-scripts start',
            'build': 'react-scripts build'
          }
        }, null, 2),
        'public/index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Todo App</title>
</head>
<body>
  <div id="root"></div>
</body>
</html>`,
        'src/index.js': `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);`,
        'src/App.js': `import React, { useState, useEffect } from 'react';

function App() {
  const [todos, setTodos] = useState([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('todos');
    if (saved) setTodos(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('todos', JSON.stringify(todos));
  }, [todos]);

  const addTodo = () => {
    if (input.trim()) {
      setTodos([...todos, { id: Date.now(), text: input, completed: false }]);
      setInput('');
    }
  };

  const toggleTodo = (id) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  const deleteTodo = (id) => {
    setTodos(todos.filter(todo => todo.id !== id));
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', fontFamily: 'Arial' }}>
      <h1>Todo List</h1>
      <div style={{ marginBottom: '20px' }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && addTodo()}
          placeholder="Add a new task..."
          style={{ padding: '10px', width: '70%', marginRight: '10px' }}
        />
        <button onClick={addTodo} style={{ padding: '10px 20px' }}>Add</button>
      </div>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {todos.map(todo => (
          <li key={todo.id} style={{ 
            padding: '10px',
            marginBottom: '10px',
            background: '#f5f5f5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <label style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => toggleTodo(todo.id)}
                style={{ marginRight: '10px' }}
              />
              <span style={{ 
                textDecoration: todo.completed ? 'line-through' : 'none',
                color: todo.completed ? '#999' : '#000'
              }}>
                {todo.text}
              </span>
            </label>
            <button onClick={() => deleteTodo(todo.id)} style={{ 
              background: '#ff4444',
              color: 'white',
              border: 'none',
              padding: '5px 10px',
              cursor: 'pointer'
            }}>
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;`
      }
    };
  }

  private generateMarkdownEditor(): { files: Record<string, string> } {
    return {
      files: {
        'package.json': JSON.stringify({
          name: 'markdown-editor',
          version: '1.0.0',
          dependencies: {
            'react': '^18.2.0',
            'react-dom': '^18.2.0',
            'react-scripts': '5.0.1',
            'marked': '^9.1.6'
          },
          scripts: {
            'start': 'react-scripts start',
            'build': 'react-scripts build'
          }
        }, null, 2),
        'public/index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Markdown Editor</title>
</head>
<body>
  <div id="root"></div>
</body>
</html>`,
        'src/index.js': `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);`,
        'src/App.js': `import React, { useState } from 'react';
import { marked } from 'marked';

function App() {
  const [markdown, setMarkdown] = useState('# Hello Markdown\\n\\nStart typing...');

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'Arial' }}>
      <div style={{ flex: 1, padding: '20px', borderRight: '1px solid #ddd' }}>
        <h2>Editor</h2>
        <textarea
          value={markdown}
          onChange={(e) => setMarkdown(e.target.value)}
          style={{ 
            width: '100%',
            height: 'calc(100% - 50px)',
            padding: '10px',
            fontFamily: 'monospace',
            fontSize: '14px',
            border: '1px solid #ddd',
            resize: 'none'
          }}
        />
      </div>
      <div style={{ flex: 1, padding: '20px', overflow: 'auto' }}>
        <h2>Preview</h2>
        <div 
          dangerouslySetInnerHTML={{ __html: marked(markdown) }}
          style={{ lineHeight: '1.6' }}
        />
      </div>
    </div>
  );
}

export default App;`
      }
    };
  }

  private generateGenericApp(): { files: Record<string, string> } {
    return {
      files: {
        'package.json': JSON.stringify({
          name: 'generic-app',
          version: '1.0.0',
          dependencies: {
            'react': '^18.2.0',
            'react-dom': '^18.2.0',
            'react-scripts': '5.0.1'
          },
          scripts: {
            'start': 'react-scripts start',
            'build': 'react-scripts build'
          }
        }, null, 2),
        'public/index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>App</title>
</head>
<body>
  <div id="root"></div>
</body>
</html>`,
        'src/index.js': `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);`,
        'src/App.js': `import React from 'react';

function App() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1>Welcome to your new app!</h1>
      <p>This is a basic React application.</p>
    </div>
  );
}

export default App;`
      }
    };
  }
}
