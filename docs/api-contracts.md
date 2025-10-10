# API Contracts

## OpenAPI Specification

### Backend API (Port 8000)

```yaml
openapi: 3.0.0
info:
  title: Dream Backend API
  version: 1.0.0
  description: API for managing AI-generated applications

servers:
  - url: http://localhost:8000
    description: Development server

paths:
  /api/apps/generate:
    post:
      summary: Generate a new application from natural language
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                prompt:
                  type: string
                  example: "Create a CSV viewer app"
                context:
                  type: object
                  description: Optional context for generation
      responses:
        '201':
          description: Application created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/App'
        '400':
          description: Invalid request
        '500':
          description: Server error

  /api/apps:
    get:
      summary: List all applications
      parameters:
        - name: limit
          in: query
          schema:
            type: integer
            default: 10
        - name: offset
          in: query
          schema:
            type: integer
            default: 0
      responses:
        '200':
          description: List of applications
          content:
            application/json:
              schema:
                type: object
                properties:
                  apps:
                    type: array
                    items:
                      $ref: '#/components/schemas/App'
                  total:
                    type: integer

  /api/apps/{appId}:
    get:
      summary: Get application details
      parameters:
        - name: appId
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Application details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/App'
        '404':
          description: Application not found

    patch:
      summary: Modify an existing application
      parameters:
        - name: appId
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                prompt:
                  type: string
                  example: "Add sorting feature"
                changes:
                  type: object
                  description: Explicit code changes
      responses:
        '200':
          description: Application updated
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/App'

    delete:
      summary: Delete an application
      parameters:
        - name: appId
          in: path
          required: true
          schema:
            type: string
      responses:
        '204':
          description: Application deleted
        '404':
          description: Application not found

  /api/apps/{appId}/actions:
    post:
      summary: Track user actions for inference
      parameters:
        - name: appId
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                action:
                  type: string
                  example: "click"
                target:
                  type: string
                data:
                  type: object
      responses:
        '200':
          description: Action recorded and analyzed
          content:
            application/json:
              schema:
                type: object
                properties:
                  suggestions:
                    type: array
                    items:
                      $ref: '#/components/schemas/Suggestion'

  /api/apps/{appId}/apply:
    post:
      summary: Apply suggested changes
      parameters:
        - name: appId
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                suggestionId:
                  type: string
      responses:
        '200':
          description: Changes applied
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/App'

  /api/health:
    get:
      summary: Health check
      responses:
        '200':
          description: Service is healthy
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                    example: "ok"
                  services:
                    type: object

components:
  schemas:
    App:
      type: object
      properties:
        id:
          type: string
          format: uuid
        name:
          type: string
        prompt:
          type: string
        status:
          type: string
          enum: [generating, running, stopped, error]
        previewUrl:
          type: string
          format: uri
        code:
          type: object
          properties:
            files:
              type: object
              additionalProperties:
                type: string
        metadata:
          type: object
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time

    Suggestion:
      type: object
      properties:
        id:
          type: string
        type:
          type: string
          enum: [improvement, fix, feature]
        description:
          type: string
        confidence:
          type: number
          minimum: 0
          maximum: 1
        changes:
          type: object
        autoApply:
          type: boolean
```

### Planner Service API (Port 8001)

```yaml
openapi: 3.0.0
info:
  title: Isekai Planner Service
  version: 1.0.0
  description: NLP/AI service for intent analysis and code generation

paths:
  /analyze:
    post:
      summary: Analyze natural language intent
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                prompt:
                  type: string
                context:
                  type: object
      responses:
        '200':
          description: Intent analysis result
          content:
            application/json:
              schema:
                type: object
                properties:
                  intent:
                    type: string
                  components:
                    type: array
                    items:
                      type: string
                  plan:
                    type: object
                  code:
                    type: object

  /infer:
    post:
      summary: Infer user intent from actions
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                action:
                  type: object
                context:
                  type: object
                history:
                  type: array
      responses:
        '200':
          description: Inference result
          content:
            application/json:
              schema:
                type: object
                properties:
                  suggestions:
                    type: array
                  confidence:
                    type: number
```

### Sandbox Service API (Port 8002)

```yaml
openapi: 3.0.0
info:
  title: Isekai Sandbox Runtime
  version: 1.0.0
  description: Secure isolated execution environment

paths:
  /execute:
    post:
      summary: Execute code in sandbox
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                appId:
                  type: string
                files:
                  type: object
                  additionalProperties:
                    type: string
                dependencies:
                  type: object
                config:
                  type: object
      responses:
        '201':
          description: App started
          content:
            application/json:
              schema:
                type: object
                properties:
                  appId:
                    type: string
                  url:
                    type: string
                  status:
                    type: string
                  logs:
                    type: string

  /apps/{appId}:
    get:
      summary: Get sandbox app status
      parameters:
        - name: appId
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: App status

    patch:
      summary: Hot reload changes
      parameters:
        - name: appId
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                files:
                  type: object
      responses:
        '200':
          description: Changes applied

    delete:
      summary: Stop and remove app
      parameters:
        - name: appId
          in: path
          required: true
          schema:
            type: string
      responses:
        '204':
          description: App removed

  /apps/{appId}/logs:
    get:
      summary: Get application logs
      parameters:
        - name: appId
          in: path
          required: true
          schema:
            type: string
        - name: tail
          in: query
          schema:
            type: integer
            default: 100
      responses:
        '200':
          description: Application logs
          content:
            application/json:
              schema:
                type: object
                properties:
                  logs:
                    type: string
```

## Data Models

### Application
- **id**: Unique identifier (UUID)
- **name**: Generated or user-provided name
- **prompt**: Original natural language prompt
- **status**: Current state (generating, running, stopped, error)
- **previewUrl**: URL to access running app
- **code**: Object containing all file contents
- **metadata**: Additional information (framework, language, etc.)
- **createdAt**: Creation timestamp
- **updatedAt**: Last modification timestamp

### Suggestion
- **id**: Unique identifier
- **type**: improvement | fix | feature
- **description**: Human-readable description
- **confidence**: 0-1 confidence score
- **changes**: Specific code changes
- **autoApply**: Whether to auto-apply without confirmation

## Communication Protocols

### Backend ↔ Planner
- Protocol: gRPC (HTTP/2 fallback)
- Format: Protocol Buffers
- Timeout: 30s for generation, 5s for inference

### Backend ↔ Sandbox
- Protocol: REST HTTP
- Format: JSON
- Timeout: 60s for execute, 10s for updates

### Frontend ↔ Backend
- Protocol: REST HTTP + WebSocket (for live updates)
- Format: JSON
- Authentication: JWT tokens
