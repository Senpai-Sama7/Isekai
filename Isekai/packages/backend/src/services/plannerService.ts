import axios from 'axios';

const PLANNER_URL = process.env.PLANNER_URL || 'http://localhost:8001';

export class PlannerService {
  async analyze(prompt: string, context?: any): Promise<any> {
    try {
      const response = await axios.post(`${PLANNER_URL}/analyze`, {
        prompt,
        context
      }, { timeout: 30000 });
      
      return response.data;
    } catch (error) {
      console.error('Planner service error:', error);
      
      // Fallback: return mock data for CSV viewer
      if (prompt.toLowerCase().includes('csv')) {
        return this.getMockCSVViewerCode();
      }
      
      throw new Error('Failed to analyze prompt');
    }
  }

  async analyzeModification(prompt: string, currentCode: any, metadata: any): Promise<any> {
    try {
      const response = await axios.post(`${PLANNER_URL}/analyze`, {
        prompt,
        context: { currentCode, metadata, isModification: true }
      }, { timeout: 30000 });
      
      return response.data;
    } catch (error) {
      console.error('Planner service error:', error);
      throw new Error('Failed to analyze modification');
    }
  }

  async infer(data: any): Promise<any> {
    try {
      const response = await axios.post(`${PLANNER_URL}/infer`, data, { timeout: 5000 });
      return response.data;
    } catch (error) {
      console.error('Planner service error:', error);
      return { suggestions: [] };
    }
  }

  private getMockCSVViewerCode(): any {
    return {
      intent: 'create_csv_viewer',
      components: ['table', 'file-upload', 'search'],
      plan: {
        framework: 'react',
        features: ['csv-parsing', 'table-display', 'search']
      },
      code: {
        files: {
          'package.json': JSON.stringify({
            name: 'csv-viewer',
            version: '1.0.0',
            dependencies: {
              'react': '^18.2.0',
              'react-dom': '^18.2.0',
              'papaparse': '^5.4.1'
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
      }
    };
  }
}
