# Product Overview

Isekai is an AI agent system that transforms natural language commands into runnable applications through live iteration and real-time modification based on user actions.

## Core Functionality

- **Natural Language Processing**: Users describe applications in plain English
- **Code Generation**: AI generates functional code from user descriptions  
- **Live Iteration**: Real-time modification and enhancement of generated apps
- **Secure Execution**: Isolated sandbox environment for running generated code
- **Interactive Feedback**: System learns from user interactions to improve apps

## Key Use Cases

- Rapid prototyping of web applications
- CSV data viewers and processors
- Interactive dashboards and tools
- Educational coding examples
- Quick utility applications

## Architecture Components

1. **Frontend**: React-based UI for user interaction (ports 3000/3001)
2. **Backend**: Express API server coordinating requests (port 8000/8080)  
3. **Planner**: AI-powered natural language processor (port 8001/8090)
4. **Sandbox**: Secure isolated runtime environment (port 8002/8070)

The system emphasizes security through process isolation, network restrictions, and resource limits while maintaining a seamless user experience for rapid application development.