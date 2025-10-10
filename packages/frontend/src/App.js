import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

function App() {
  const [prompt, setPrompt] = useState('');
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [health, setHealth] = useState(null);

  useEffect(() => {
    loadApps();
    checkHealth();
  }, []);

  const checkHealth = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/health`);
      setHealth(response.data);
    } catch (error) {
      console.error('Health check failed:', error);
    }
  };

  const loadApps = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/apps`);
      setApps(response.data.apps);
    } catch (error) {
      console.error('Error loading apps:', error);
    }
  };

  const generateApp = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/api/apps/generate`, {
        prompt
      });
      
      setSelectedApp(response.data);
      setApps([response.data, ...apps]);
      setPrompt('');
    } catch (error) {
      console.error('Error generating app:', error);
      alert('Failed to generate app. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const viewApp = async (appId) => {
    try {
      const response = await axios.get(`${API_URL}/api/apps/${appId}`);
      setSelectedApp(response.data);
    } catch (error) {
      console.error('Error loading app:', error);
    }
  };

  const deleteApp = async (appId) => {
    if (!window.confirm('Are you sure you want to delete this app?')) return;

    try {
      await axios.delete(`${API_URL}/api/apps/${appId}`);
      setApps(apps.filter(app => app.id !== appId));
      if (selectedApp?.id === appId) {
        setSelectedApp(null);
      }
    } catch (error) {
      console.error('Error deleting app:', error);
    }
  };

  return (
    <div className="App">
      <header className="header">
        <h1>🌟 Dream AI Agent</h1>
        <p>Turn natural language into runnable apps</p>
        {health && (
          <div className="health-status">
            <span className={`status-dot ${health.status === 'ok' ? 'ok' : 'error'}`}></span>
            Services: Backend ({health.services.backend}), 
            Planner ({health.services.planner}), 
            Sandbox ({health.services.sandbox})
          </div>
        )}
      </header>

      <div className="container">
        <div className="sidebar">
          <form onSubmit={generateApp} className="prompt-form">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe your app... (e.g., 'Create a CSV viewer app')"
              rows="4"
              disabled={loading}
            />
            <button type="submit" disabled={loading || !prompt.trim()}>
              {loading ? 'Generating...' : 'Generate App'}
            </button>
          </form>

          <div className="app-list">
            <h3>Your Apps</h3>
            {apps.length === 0 ? (
              <p className="no-apps">No apps yet. Generate one above!</p>
            ) : (
              apps.map(app => (
                <div 
                  key={app.id} 
                  className={`app-item ${selectedApp?.id === app.id ? 'active' : ''}`}
                  onClick={() => viewApp(app.id)}
                >
                  <div className="app-item-header">
                    <h4>{app.name}</h4>
                    <span className={`status ${app.status}`}>{app.status}</span>
                  </div>
                  <p className="app-prompt">{app.prompt}</p>
                  <button 
                    className="delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteApp(app.id);
                    }}
                  >
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="main-content">
          {selectedApp ? (
            <div className="app-details">
              <h2>{selectedApp.name}</h2>
              <p className="meta">Status: <strong>{selectedApp.status}</strong></p>
              <p className="meta">Created: {new Date(selectedApp.createdAt).toLocaleString()}</p>
              
              {selectedApp.previewUrl && (
                <div className="preview-section">
                  <h3>Preview</h3>
                  <a 
                    href={selectedApp.previewUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="preview-link"
                  >
                    Open App →
                  </a>
                  <p className="preview-url">{selectedApp.previewUrl}</p>
                </div>
              )}

              <div className="code-section">
                <h3>Generated Code</h3>
                <div className="file-tree">
                  {Object.entries(selectedApp.code.files || {}).map(([filename, content]) => (
                    <details key={filename} className="file-details">
                      <summary>{filename}</summary>
                      <pre><code>{content}</code></pre>
                    </details>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <h2>Welcome to Dream!</h2>
              <p>Generate an app by describing what you want in the prompt above.</p>
              <div className="examples">
                <h3>Try these examples:</h3>
                <ul>
                  <li>"Create a CSV viewer app"</li>
                  <li>"Build a todo list application"</li>
                  <li>"Make a markdown editor"</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
