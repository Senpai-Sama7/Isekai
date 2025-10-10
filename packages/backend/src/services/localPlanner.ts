import { randomUUID } from 'crypto';

export interface LocalPlanResult {
  intent: string;
  components: string[];
  plan: {
    framework: string;
    features: string[];
    notes?: string[];
  };
  code: {
    files: Record<string, string>;
  };
}

export interface LocalSuggestion {
  id?: string;
  title: string;
  description: string;
  changes: Record<string, string>;
}

interface InferInput {
  action: string;
  target: string;
  data: any;
  context?: any;
  currentCode: Record<string, any>;
}

export class LocalPlanner {
  private readonly defaultTitle = 'Isekai App';

  generateApp(prompt: string, context?: any): LocalPlanResult {
    const normalized = prompt.toLowerCase();

    if (normalized.includes('csv')) {
      return this.buildCsvViewer(prompt, context);
    }

    if (normalized.includes('todo') || normalized.includes('task')) {
      return this.buildTodoApp(prompt, context);
    }

    if (normalized.includes('dashboard')) {
      return this.buildDashboard(prompt, context);
    }

    return this.buildStaticApp(prompt, context);
  }

  generateModification(prompt: string, currentCode: Record<string, string>, metadata: any): LocalPlanResult {
    const normalized = prompt.toLowerCase();
    const files = { ...currentCode };
    let updated = false;

    if (normalized.includes('dark') && files['styles.css']) {
      files['styles.css'] = this.applyDarkMode(files['styles.css']);
      updated = true;
    }

    if (normalized.includes('title')) {
      const newTitle = this.extractTitle(prompt) || metadata?.intent || this.defaultTitle;
      files['index.html'] = this.replaceHtmlTitle(files['index.html'], newTitle);
      updated = true;
    }

    if (normalized.includes('search') && files['app.js'] && !files['app.js'].includes('filter')) {
      files['app.js'] = this.injectSearchSupport(files['app.js']);
      updated = true;
    }

    if (!updated) {
      return this.generateApp(prompt, metadata?.context);
    }

    return {
      intent: metadata?.intent || 'modify_app',
      components: metadata?.components || [],
      plan: {
        framework: 'static-html',
        features: ['applied_modification'],
        notes: [prompt]
      },
      code: {
        files
      }
    };
  }

  infer(input: InferInput): { suggestions: LocalSuggestion[] } {
    const suggestions: LocalSuggestion[] = [];
    const files = input.currentCode?.files || {};
    const appJs = files['app.js'];

    if (typeof appJs === 'string' && !appJs.includes('console.log("[Analytics]"')) {
      suggestions.push({
        id: randomUUID(),
        title: 'Add interaction analytics',
        description: 'Log user interactions with timestamps for diagnostics.',
        changes: {
          'app.js': this.injectAnalytics(appJs)
        }
      });
    }

    if (typeof files['styles.css'] === 'string' && !files['styles.css'].includes('--primary-bg')) {
      suggestions.push({
        id: randomUUID(),
        title: 'Introduce CSS variables',
        description: 'Refactor styles to use CSS variables for theme control.',
        changes: {
          'styles.css': this.addCssVariables(files['styles.css'])
        }
      });
    }

    return { suggestions };
  }

  private buildCsvViewer(prompt: string, context?: any): LocalPlanResult {
    const title = context?.title || this.extractTitle(prompt) || 'CSV Viewer';
    const files = this.composeStaticBundle({
      title,
      description: 'Upload CSV files to explore, search, and sort data directly in the browser.',
      styles: this.baseStyles() + `
.table-container {
  overflow-x: auto;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  max-height: 480px;
}

th, td {
  padding: 0.625rem;
  border-bottom: 1px solid var(--border-color);
}

th {
  background: var(--surface-accent);
  text-align: left;
}

tr:hover {
  background: rgba(80, 70, 229, 0.08);
}`,
      script: this.wrapWithDomReady(`
const fileInput = document.querySelector('#file-input');
const tableHead = document.querySelector('#table-head');
const tableBody = document.querySelector('#table-body');
const searchInput = document.querySelector('#search-input');
const summary = document.querySelector('#summary');

let originalRows = [];

function parseCsv(text) {
  const [headerLine, ...dataLines] = text.trim().split(/\r?\n/);
  const headers = headerLine.split(',').map(h => h.trim());
  const rows = dataLines.map(line => {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || '']));
  });

  return { headers, rows };
}

function renderTable(headers, rows) {
  tableHead.innerHTML = '';
  tableBody.innerHTML = '';

  const headerRow = document.createElement('tr');
  headers.forEach(header => {
    const th = document.createElement('th');
    th.textContent = header;
    headerRow.appendChild(th);
  });
  tableHead.appendChild(headerRow);

  rows.forEach(row => {
    const tr = document.createElement('tr');
    headers.forEach(header => {
      const td = document.createElement('td');
      td.textContent = row[header] || '';
      tr.appendChild(td);
    });
    tableBody.appendChild(tr);
  });

  summary.textContent = rows.length.toLocaleString() + ' rows loaded';
}

function filterRows(query) {
  if (!query) {
    renderTable(currentHeaders, originalRows);
    return;
  }

  const lowerQuery = query.toLowerCase();
  const filtered = originalRows.filter(row => {
    return Object.values(row).some(value => String(value).toLowerCase().includes(lowerQuery));
  });

  renderTable(currentHeaders, filtered);
}

let currentHeaders = [];

fileInput.addEventListener('change', event => {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = fileEvent => {
    const text = String(fileEvent.target?.result || '');
    const { headers, rows } = parseCsv(text);
    currentHeaders = headers;
    originalRows = rows;
    renderTable(headers, rows);
  };
  reader.readAsText(file);
});

searchInput.addEventListener('input', event => {
  filterRows(event.target.value);
});
`),
      body: `
<div class="panel">
  <header class="panel__header">
    <div>
      <h1>${title}</h1>
      <p>Upload a CSV file to inspect its contents instantly.</p>
    </div>
    <label class="file-upload">
      <input id="file-input" type="file" accept=".csv" />
      <span>Select CSV</span>
    </label>
  </header>
  <div class="controls">
    <label class="search">
      <span>Search</span>
      <input id="search-input" type="search" placeholder="Filter rows..." />
    </label>
    <span id="summary" class="summary">No file loaded</span>
  </div>
  <div class="table-container">
    <table>
      <thead id="table-head"></thead>
      <tbody id="table-body"></tbody>
    </table>
  </div>
</div>
`
    });

    return {
      intent: 'create_csv_viewer',
      components: ['file-input', 'search', 'table'],
      plan: {
        framework: 'static-html',
        features: ['csv parsing', 'search', 'responsive layout']
      },
      code: { files }
    };
  }

  private buildTodoApp(prompt: string, context?: any): LocalPlanResult {
    const title = context?.title || this.extractTitle(prompt) || 'Todo List';
    const files = this.composeStaticBundle({
      title,
      description: 'Track tasks with persistent storage and intuitive filtering.',
      styles: this.baseStyles() + `
.todo-input {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.todo-input input {
  flex: 1;
}

.todo-list {
  margin-top: 1rem;
  display: grid;
  gap: 0.5rem;
}

.todo-item {
  background: var(--surface);
  padding: 0.75rem 1rem;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.08);
}

.todo-item.completed {
  opacity: 0.6;
  text-decoration: line-through;
}
`,
      script: this.wrapWithDomReady(`
const form = document.querySelector('#todo-form');
const input = document.querySelector('#todo-input');
const list = document.querySelector('#todo-list');
const filterButtons = document.querySelectorAll('[data-filter]');

let todos = loadTodos();
let filter = 'all';

function loadTodos() {
  try {
    const stored = localStorage.getItem('todos');
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Unable to load todos', error);
    return [];
  }
}

function saveTodos() {
  localStorage.setItem('todos', JSON.stringify(todos));
}

function render() {
  list.innerHTML = '';
  const filtered = todos.filter(todo => {
    if (filter === 'completed') return todo.completed;
    if (filter === 'active') return !todo.completed;
    return true;
  });

  if (filtered.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = 'No tasks yet. Add your first task above!';
    empty.className = 'empty';
    list.appendChild(empty);
    return;
  }

  filtered.forEach(todo => {
    const item = document.createElement('div');
    item.className = 'todo-item' + (todo.completed ? ' completed' : '');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = todo.completed;
    checkbox.addEventListener('change', () => toggleTodo(todo.id));

    const content = document.createElement('span');
    content.textContent = todo.text;

    const remove = document.createElement('button');
    remove.textContent = 'Remove';
    remove.className = 'danger';
    remove.addEventListener('click', () => deleteTodo(todo.id));

    item.append(checkbox, content, remove);
    list.appendChild(item);
  });
}

function addTodo(text) {
  const todo = {
    id: crypto.randomUUID(),
    text,
    completed: false,
    createdAt: new Date().toISOString()
  };
  todos = [todo, ...todos];
  saveTodos();
  render();
}

function toggleTodo(id) {
  todos = todos.map(todo => todo.id === id ? { ...todo, completed: !todo.completed } : todo);
  saveTodos();
  render();
}

function deleteTodo(id) {
  todos = todos.filter(todo => todo.id !== id);
  saveTodos();
  render();
}

form.addEventListener('submit', event => {
  event.preventDefault();
  const value = input.value.trim();
  if (!value) return;
  addTodo(value);
  input.value = '';
  input.focus();
});

filterButtons.forEach(button => {
  button.addEventListener('click', () => {
    filterButtons.forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
    filter = button.dataset.filter || 'all';
    render();
  });
});

render();
`),
      body: `
<div class="panel">
  <header class="panel__header">
    <div>
      <h1>${title}</h1>
      <p>Organise your tasks and keep track of progress.</p>
    </div>
  </header>
  <form id="todo-form" class="todo-input">
    <input id="todo-input" type="text" placeholder="Add a new task" autocomplete="off" />
    <button type="submit">Add Task</button>
  </form>
  <div class="filters">
    <button type="button" class="active" data-filter="all">All</button>
    <button type="button" data-filter="active">Active</button>
    <button type="button" data-filter="completed">Completed</button>
  </div>
  <div id="todo-list" class="todo-list"></div>
</div>
`
    });

    return {
      intent: 'create_todo_app',
      components: ['form', 'list', 'filters'],
      plan: {
        framework: 'static-html',
        features: ['localStorage persistence', 'filtering']
      },
      code: { files }
    };
  }

  private buildDashboard(prompt: string, context?: any): LocalPlanResult {
    const title = context?.title || this.extractTitle(prompt) || 'Metrics Dashboard';
    const files = this.composeStaticBundle({
      title,
      description: 'Responsive dashboard with live metrics and charts.',
      styles: this.baseStyles() + `
.dashboard {
  display: grid;
  gap: 1rem;
}

.metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
}

.metric {
  background: var(--surface);
  padding: 1rem;
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.08);
}

.chart {
  background: var(--surface);
  padding: 1rem;
  border-radius: 12px;
  min-height: 280px;
}
`,
      script: this.wrapWithDomReady(`
const metricElements = document.querySelectorAll('[data-metric]');
const chartCanvas = document.querySelector('#chart');

function generateMetricValue(seed) {
  const base = 50 + Math.sin(Date.now() / (seed * 1000)) * 20;
  return Math.round(base * 10) / 10;
}

function updateMetrics() {
  metricElements.forEach(element => {
    const key = element.getAttribute('data-metric') || 'value';
    element.textContent = generateMetricValue(key.length).toLocaleString();
  });
}

function renderChart() {
  if (!(chartCanvas instanceof HTMLCanvasElement)) {
    return;
  }

  const ctx = chartCanvas.getContext('2d');
  if (!ctx) {
    return;
  }

  const width = chartCanvas.width;
  const height = chartCanvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = '#5046e5';
  ctx.lineWidth = 2;
  ctx.beginPath();

  const points = 24;
  for (let i = 0; i < points; i++) {
    const value = 0.4 + Math.sin((Date.now() / 1000 + i) / 2) * 0.4;
    const x = (i / (points - 1)) * width;
    const y = height - value * height;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }

  ctx.stroke();
}

updateMetrics();
renderChart();
setInterval(() => {
  updateMetrics();
  renderChart();
}, 3000);
`),
      body: `
<div class="panel dashboard">
  <header class="panel__header">
    <div>
      <h1>${title}</h1>
      <p>Monitor key performance indicators in real time.</p>
    </div>
  </header>
  <section class="metrics">
    <article class="metric">
      <h2>Active Users</h2>
      <p data-metric="users" class="metric__value">0</p>
    </article>
    <article class="metric">
      <h2>Conversion Rate</h2>
      <p data-metric="conversion" class="metric__value">0%</p>
    </article>
    <article class="metric">
      <h2>Revenue</h2>
      <p data-metric="revenue" class="metric__value">$0</p>
    </article>
  </section>
  <section class="chart">
    <canvas id="chart" width="640" height="320"></canvas>
  </section>
</div>
`
    });

    return {
      intent: 'create_dashboard',
      components: ['metrics', 'chart'],
      plan: {
        framework: 'static-html',
        features: ['auto-refresh metrics', 'canvas visualization']
      },
      code: { files }
    };
  }

  private buildStaticApp(prompt: string, context?: any): LocalPlanResult {
    const title = context?.title || this.extractTitle(prompt) || this.defaultTitle;
    const files = this.composeStaticBundle({
      title,
      description: `Generated interface for: ${prompt}`,
      styles: this.baseStyles(),
      script: this.wrapWithDomReady(`
const info = document.querySelector('#prompt-info');
info.textContent = ${JSON.stringify(prompt)};
`),
      body: `
<div class="panel">
  <header class="panel__header">
    <h1>${title}</h1>
    <p>Project scaffold generated locally without external services.</p>
  </header>
  <section>
    <h2>Prompt</h2>
    <p id="prompt-info"></p>
  </section>
</div>
`
    });

    return {
      intent: 'create_static_app',
      components: ['panel', 'prompt-info'],
      plan: {
        framework: 'static-html',
        features: ['prompt summary', 'responsive layout']
      },
      code: { files }
    };
  }

  private composeStaticBundle(options: {
    title: string;
    description: string;
    styles: string;
    script: string;
    body: string;
  }): Record<string, string> {
    return {
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${options.title}</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  ${options.body}
  <script src="app.js" type="module"></script>
</body>
</html>
`,
      'styles.css': options.styles,
      'app.js': options.script,
      'README.md': `# ${options.title}

${options.description}

## Running locally

Open \`index.html\` in a modern browser. No build tools are required.
`
    };
  }

  private baseStyles(): string {
    return `:root {
  color-scheme: light dark;
  --primary: #5046e5;
  --primary-contrast: #ffffff;
  --surface: rgba(255, 255, 255, 0.72);
  --surface-accent: rgba(80, 70, 229, 0.08);
  --border-color: rgba(16, 24, 40, 0.12);
  --background: linear-gradient(135deg, #050505, #121212);
  --text: #111827;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  background: var(--background);
  color: var(--text);
  min-height: 100vh;
  padding: 2rem;
  display: flex;
  justify-content: center;
}

a {
  color: var(--primary);
}

.panel {
  width: min(960px, 100%);
  background: var(--surface);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.25);
  display: grid;
  gap: 1.5rem;
}

.panel__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

h1 {
  font-size: clamp(1.8rem, 2vw + 1rem, 2.4rem);
}

button {
  padding: 0.625rem 1rem;
  border-radius: 999px;
  border: none;
  background: var(--primary);
  color: var(--primary-contrast);
  font-weight: 600;
  cursor: pointer;
  transition: transform 120ms ease, box-shadow 120ms ease;
}

button:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 20px rgba(80, 70, 229, 0.25);
}

input, select {
  padding: 0.625rem 0.75rem;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  background: rgba(255, 255, 255, 0.85);
  font-size: 1rem;
}

.file-upload {
  position: relative;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
}

.file-upload input[type="file"] {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.controls {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
}

.summary {
  font-weight: 600;
  color: rgba(17, 24, 39, 0.72);
}

.filters {
  display: flex;
  gap: 0.5rem;
}

.filters button.active {
  background: var(--surface-accent);
  color: var(--primary);
}
`;
  }

  private wrapWithDomReady(source: string): string {
    return `document.addEventListener('DOMContentLoaded', () => {
${source.split('\n').map(line => `  ${line}`).join('\n')}
});
`;
  }

  private extractTitle(prompt: string): string | null {
    const match = prompt.match(/(?:named|called|title)\s+([\w\s]+)/i);
    if (match) {
      return match[1].trim();
    }
    return null;
  }

  private replaceHtmlTitle(html: string | undefined, title: string): string {
    if (!html) return '';
    if (html.includes('<title>')) {
      return html.replace(/<title>.*<\/title>/, `<title>${title}</title>`);
    }
    return html;
  }

  private injectSearchSupport(source: string): string {
    if (source.includes('filterRows')) {
      return source;
    }

    return source + `

function filterRows(query) {
  const event = new CustomEvent('filter-requested', { detail: { query } });
  document.dispatchEvent(event);
}
`;
  }

  private applyDarkMode(styles: string): string {
    if (styles.includes('--background-dark')) {
      return styles;
    }

    return styles + `
:root {
  --background-dark: #050505;
  --surface-dark: rgba(12, 12, 12, 0.85);
  --text-dark: #f5f5f5;
}

@media (prefers-color-scheme: dark) {
  body {
    background: var(--background-dark);
    color: var(--text-dark);
  }

  .panel {
    background: var(--surface-dark);
    color: var(--text-dark);
  }
}
`;
  }

  private injectAnalytics(source: string): string {
    if (source.includes('[Analytics]')) {
      return source;
    }

    const analyticsBlock = `
  document.body.addEventListener('click', event => {
    if (!(event.target instanceof HTMLElement)) {
      return;
    }
    const targetDescription = event.target.dataset?.analytics || event.target.innerText || event.target.tagName;
    console.log('[Analytics]', new Date().toISOString(), targetDescription.trim());
  });
`;

    if (source.includes('document.addEventListener')) {
      return source.replace(
        /document\.addEventListener\(["']DOMContentLoaded["'],\s*\(\)\s*=>\s*{/,
        match => `${match}${analyticsBlock}`
      );
    }

    return this.wrapWithDomReady(`${analyticsBlock}
${source}`);
  }

  private addCssVariables(styles: string): string {
    if (styles.includes(':root')) {
      return styles.replace(
        ':root {',
        `:root {
  --primary-bg: #5046e5;
  --secondary-bg: rgba(80, 70, 229, 0.08);
  --text-strong: #111827;`
      );
    }

    return `:root {
  --primary-bg: #5046e5;
  --secondary-bg: rgba(80, 70, 229, 0.08);
  --text-strong: #111827;
}

${styles}`;
  }
}
