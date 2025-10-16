import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

function App() {
  const [prompt, setPrompt] = useState('');
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [health, setHealth] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [interactions, setInteractions] = useState([]);

  const interactionTimerRef = useRef(null);

  useEffect(() => {
    loadApps();
    checkHealth();

    // Check for suggestions periodically
    const suggestionInterval = setInterval(checkForSuggestions, 30000); // Every 30 seconds

    return () => clearInterval(suggestionInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track interactions with debouncing
  const trackInteraction = useCallback((action, target, data = {}) => {
    const interaction = {
      action,
      target,
      data,
      timestamp: new Date().toISOString(),
      appId: selectedApp?.id
    };

    setInteractions(prev => [...prev, interaction]);

    // Debounce sending interactions to backend
    if (interactionTimerRef.current) {
      clearTimeout(interactionTimerRef.current);
    }

    interactionTimerRef.current = setTimeout(() => {
      sendInteractions([interaction]);
    }, 2000);
  }, [selectedApp]);

  const sendInteractions = async (interactionBatch) => {
    if (!interactionBatch.length) return;

    try {
      const response = await axios.post(`${API_URL}/api/apps/interactions`, {
        interactions: interactionBatch
      });

      if (response.data.suggestions && response.data.suggestions.length > 0) {
        setSuggestions(prev => [...response.data.suggestions, ...prev].slice(0, 5));
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error('Error sending interactions:', error);
    }
  };

  const checkForSuggestions = async () => {
    if (!selectedApp || interactions.length === 0) return;

    try {
      const response = await axios.post(`${API_URL}/api/apps/${selectedApp.id}/suggest`, {
        interactions: interactions.slice(-10) // Last 10 interactions
      });

      if (response.data.suggestions && response.data.suggestions.length > 0) {
        setSuggestions(response.data.suggestions);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error('Error checking suggestions:', error);
    }
  };

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
      trackInteraction('load', 'apps_list', { count: response.data.apps.length });
    } catch (error) {
      console.error('Error loading apps:', error);
    }
  };

  const generateApp = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    trackInteraction('generate', 'new_app', { prompt: prompt.substring(0, 100) });

    try {
      const response = await axios.post(`${API_URL}/api/apps/generate`, {
        prompt
      });

      setSelectedApp(response.data);
      setApps([response.data, ...apps]);
      setPrompt('');
      trackInteraction('generated', 'new_app', { appId: response.data.id, status: response.data.status });
    } catch (error) {
      console.error('Error generating app:', error);
      alert('Failed to generate app. Make sure the backend is running.');
      trackInteraction('error', 'generate_app', { error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const viewApp = async (appId) => {
    try {
      const response = await axios.get(`${API_URL}/api/apps/${appId}`);
      setSelectedApp(response.data);
      trackInteraction('view', 'app_details', { appId });
    } catch (error) {
      console.error('Error loading app:', error);
      trackInteraction('error', 'view_app', { appId, error: error.message });
    }
  };

  const deleteApp = async (appId) => {
    if (!window.confirm('Are you sure you want to delete this app?')) return;

    trackInteraction('delete', 'app', { appId });

    try {
      await axios.delete(`${API_URL}/api/apps/${appId}`);
      setApps(apps.filter(app => app.id !== appId));
      if (selectedApp?.id === appId) {
        setSelectedApp(null);
      }
    } catch (error) {
      console.error('Error deleting app:', error);
      trackInteraction('error', 'delete_app', { appId, error: error.message });
    }
  };

  const applySuggestion = async (suggestion) => {
    if (!selectedApp) return;

    trackInteraction('apply', 'suggestion', {
      suggestionId: suggestion.id,
      type: suggestion.type
    });

    try {
      const response = await axios.post(`${API_URL}/api/apps/${selectedApp.id}/modify`, {
        prompt: suggestion.modificationPrompt,
        changes: suggestion.changes
      });

      setSelectedApp(response.data);
      const updatedApps = apps.map(app =>
        app.id === response.data.id ? response.data : app
      );
      setApps(updatedApps);

      // Remove applied suggestion
      setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));

      alert('Suggestion applied successfully!');
    } catch (error) {
      console.error('Error applying suggestion:', error);
      alert('Failed to apply suggestion. Please try again.');
      trackInteraction('error', 'apply_suggestion', { error: error.message });
    }
  };

  const dismissSuggestion = (suggestionId) => {
    setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
    trackInteraction('dismiss', 'suggestion', { suggestionId });

    if (suggestions.length <= 1) {
      setShowSuggestions(false);
    }
  };

  const handleExampleClick = (example) => {
    setPrompt(example);
    trackInteraction('click', 'example', { example });
  };

  return (
    <div className="App">
      <header className="header">
        <h1>🌟 Isekai AI Agent</h1>
        <p>Transform natural language into live, running applications</p>
        {health && (
          <div className="health-status">
            <span className={`status-dot ${health.status === 'ok' ? 'ok' : 'error'}`}></span>
            Backend ({health.services.backend}) •
            Planner ({health.services.planner}) •
            Sandbox ({health.services.sandbox})
          </div>
        )}
      </header>

      <div className="container">
        <div className="sidebar">
          <form onSubmit={generateApp} className="prompt-form">
            <textarea
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                trackInteraction('type', 'prompt_input', { length: e.target.value.length });
              }}
              onFocus={() => trackInteraction('focus', 'prompt_input')}
              placeholder="Describe your app... (e.g., 'Create a CSV viewer with search functionality')"
              rows="4"
              disabled={loading}
            />
            <button type="submit" disabled={loading || !prompt.trim()}>
              {loading ? (
                <>
                  <span className="loading-spinner"></span>
                  <span style={{ marginLeft: '8px' }}>Generating...</span>
                </>
              ) : (
                'Generate App'
              )}
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
                  onMouseEnter={() => trackInteraction('hover', 'app_item', { appId: app.id })}
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
                    onClick={() => trackInteraction('open', 'preview_url', { appId: selectedApp.id })}
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
                    <details
                      key={filename}
                      className="file-details"
                      onToggle={(e) => trackInteraction(e.target.open ? 'expand' : 'collapse', 'file', { filename })}
                    >
                      <summary>{filename}</summary>
                      <pre><code>{content}</code></pre>
                    </details>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <h2>Welcome to Isekai!</h2>
              <p>Generate an app by describing what you want in the prompt above.</p>
              <div className="examples">
                <h3>Try these examples:</h3>
                <ul>
                  <li onClick={() => handleExampleClick("Create a CSV viewer app")}>
                    "Create a CSV viewer app"
                  </li>
                  <li onClick={() => handleExampleClick("Build a todo list application")}>
                    "Build a todo list application"
                  </li>
                  <li onClick={() => handleExampleClick("Make a markdown editor")}>
                    "Make a markdown editor"
                  </li>
                  <li onClick={() => handleExampleClick("Create a calculator with history")}>
                    "Create a calculator with history"
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI Suggestions Panel */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="suggestions-panel">
          <div className="suggestions-header">
            <h3>✨ AI Suggestions</h3>
            <button
              className="close-suggestions"
              onClick={() => {
                setShowSuggestions(false);
                trackInteraction('close', 'suggestions_panel');
              }}
              aria-label="Close suggestions"
            >
              ×
            </button>
          </div>
          <div className="suggestions-content">
            {suggestions.map((suggestion, index) => (
              <div key={suggestion.id || index} className="suggestion-item">
                <h4>{suggestion.title}</h4>
                <p>{suggestion.description}</p>
                <div className="suggestion-actions">
                  <button
                    className="suggestion-btn primary"
                    onClick={() => applySuggestion(suggestion)}
                  >
                    Apply
                  </button>
                  <button
                    className="suggestion-btn secondary"
                    onClick={() => dismissSuggestion(suggestion.id)}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
