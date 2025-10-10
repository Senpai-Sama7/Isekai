# Example Usage

This document provides examples of how to use the Isekai AI Agent system.

## Starting the System

```bash
# Install dependencies
make install

# Start all services
make dev
```

Wait for all services to start (about 30 seconds). You should see:
```
Backend server running on http://localhost:8000
Planner service running on http://localhost:8001
Sandbox service running on http://localhost:8002
Frontend available at http://localhost:3000
```

## Using the Web UI

1. Open http://localhost:3000 in your browser
2. Enter a prompt in the text area, for example:
   - "Create a CSV viewer app"
   - "Build a todo list application"
   - "Make a markdown editor"
3. Click "Generate App"
4. Wait for the app to be generated (15-30 seconds)
5. Click on the generated app in the sidebar to view details
6. Click "Open App →" to see your generated application

## Using the API

### Generate a CSV Viewer App

```bash
curl -X POST http://localhost:8000/api/apps/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Create a CSV viewer app"}'
```

Response:
```json
{
  "id": "uuid-here",
  "name": "Create A Csv",
  "prompt": "Create a CSV viewer app",
  "status": "running",
  "previewUrl": "http://localhost:9000/uuid-here",
  "code": {
    "files": {
      "package.json": "...",
      "src/App.js": "...",
      ...
    }
  },
  "metadata": {
    "intent": "csv_viewer",
    "components": ["file-upload", "table", "search"]
  }
}
```

### List All Apps

```bash
curl http://localhost:8000/api/apps
```

### Get Specific App

```bash
curl http://localhost:8000/api/apps/{appId}
```

### Modify an App

```bash
curl -X PATCH http://localhost:8000/api/apps/{appId} \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Add sorting to the table"}'
```

### Delete an App

```bash
curl -X DELETE http://localhost:8000/api/apps/{appId}
```

### Check System Health

```bash
curl http://localhost:8000/api/health
```

Response:
```json
{
  "status": "ok",
  "services": {
    "backend": "ok",
    "planner": "ok",
    "sandbox": "ok"
  }
}
```

## Example Prompts

### CSV Viewer
```
Create a CSV viewer app
```
**Generates:** A React app with file upload, table display, and search functionality using PapaCSV library.

### Todo List
```
Build a todo list application
```
**Generates:** A React app with add/complete/delete tasks and localStorage persistence.

### Markdown Editor
```
Make a markdown editor
```
**Generates:** A React app with split-pane markdown editor and live preview using the marked library.

## Generated App Features

### CSV Viewer App Includes:
- File input for CSV upload
- Dynamic table rendering
- Column headers
- Search/filter functionality
- Responsive table design
- PapaCSV integration for parsing

### Access Your Generated App

After generation, your app will be:
1. Stored in the database
2. Running in an isolated sandbox
3. Available at a unique URL (e.g., http://localhost:9000/{appId})
4. Visible in the frontend UI

## Testing Generated Apps

### Using the CSV Viewer

1. Generate a CSV viewer app
2. Open the preview URL
3. Create a test CSV file:

```csv
Name,Age,City
John Doe,30,New York
Jane Smith,25,San Francisco
Bob Johnson,35,Chicago
```

4. Upload the CSV file
5. See the data displayed in a table
6. Try the search functionality

## Development Tips

### Viewing Logs

Backend logs:
```bash
cd packages/backend && npm run dev
```

Planner logs:
```bash
cd packages/planner && npm run dev
```

Sandbox logs:
```bash
cd packages/sandbox && npm run dev
```

### Database

SQLite database is stored at `packages/data/dream.db` (auto-created on first run).

To inspect:
```bash
sqlite3 packages/data/dream.db
.tables
SELECT * FROM apps;
```

### Generated App Files

Apps are stored in: `packages/sandbox/runtime/apps/{appId}/`

You can inspect the generated files directly:
```bash
ls packages/sandbox/runtime/apps/{appId}/
cat packages/sandbox/runtime/apps/{appId}/src/App.js
```

## Troubleshooting

### Port Already in Use
If ports are already in use, you can change them via environment variables:
```bash
PORT=8000 cd packages/backend && npm run dev
PORT=8001 cd packages/planner && npm run dev
PORT=8002 cd packages/sandbox && npm run dev
PORT=3000 cd packages/frontend && npm run dev
```

### App Generation Fails
- Check all services are running
- Verify ports are not blocked
- Check logs for error messages
- Ensure npm and node versions meet requirements

### Sandbox Apps Don't Start
- Verify sandbox service is running
- Check disk space availability
- Ensure npm install succeeds in generated apps
- Look at sandbox logs for npm errors

## Next Steps

- Extend the planner to support more app types
- Add user authentication
- Implement WebSocket for live updates
- Add more sophisticated NLP/AI for intent analysis
- Implement Docker containers for better isolation
- Add code modification capabilities
- Support multiple frameworks (Vue, Svelte, etc.)
