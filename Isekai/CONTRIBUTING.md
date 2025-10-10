# Contributing to Dream

Thank you for your interest in contributing to Dream! This document provides guidelines and instructions for contributing.

## Development Setup

### Prerequisites
- Node.js 18+ and npm 9+
- Git
- Basic knowledge of TypeScript and React

### Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/Dream.git
   cd Dream
   ```
3. Install dependencies:
   ```bash
   make install
   ```
4. Start development servers:
   ```bash
   make dev
   ```

## Project Structure

```
dream/
├── packages/
│   ├── backend/          # Express API server
│   │   ├── src/
│   │   │   ├── controllers/  # Request handlers
│   │   │   ├── db/           # Database layer
│   │   │   ├── routes/       # API routes
│   │   │   ├── services/     # Business logic
│   │   │   └── index.ts      # Entry point
│   │   └── tests/            # Tests
│   ├── frontend/         # React UI
│   │   ├── public/
│   │   └── src/
│   ├── planner/          # NLP/AI service
│   │   └── src/
│   │       └── services/     # Intent analysis & code gen
│   └── sandbox/          # Isolated runtime
│       └── src/
│           └── services/     # Sandbox management
├── docs/                 # Documentation
└── Makefile             # Build automation
```

## Making Changes

### Creating a New Feature

1. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes following our coding standards

3. Write tests for your changes

4. Run tests and linting:
   ```bash
   make test
   make lint
   ```

5. Commit your changes:
   ```bash
   git commit -m "feat: add your feature description"
   ```

6. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

7. Open a Pull Request

## Coding Standards

### TypeScript/JavaScript
- Use TypeScript for all new backend code
- Follow ESLint rules (configured in each package)
- Use async/await for asynchronous code
- Add JSDoc comments for public APIs
- Use meaningful variable and function names

### React
- Use functional components with hooks
- Keep components small and focused
- Extract reusable logic into custom hooks
- Use CSS-in-JS or CSS modules for styling

### API Design
- Follow RESTful conventions
- Use appropriate HTTP methods and status codes
- Version APIs when making breaking changes
- Document all endpoints in OpenAPI format

## Testing

### Running Tests

```bash
# All tests
make test

# Specific package
cd packages/backend && npm test

# Smoke test
make smoke-test
```

### Writing Tests

- Write unit tests for business logic
- Write integration tests for API endpoints
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)

Example:
```typescript
describe('AppController', () => {
  it('should generate a CSV viewer app from prompt', async () => {
    // Arrange
    const controller = new AppController();
    const prompt = 'Create a CSV viewer app';
    
    // Act
    const result = await controller.generateApp(prompt);
    
    // Assert
    expect(result.status).toBe('running');
    expect(result.code.files).toHaveProperty('src/App.js');
  });
});
```

## Adding New App Types

To add support for a new app type:

1. Update `IntentAnalyzer` in `packages/planner/src/services/intentAnalyzer.ts`:
   ```typescript
   if (lowerPrompt.includes('your-app-type')) {
     return {
       type: 'your_app_type',
       components: ['component1', 'component2'],
       plan: {
         framework: 'react',
         features: ['feature1', 'feature2']
       }
     };
   }
   ```

2. Add code generation in `CodeGenerator` in `packages/planner/src/services/codeGenerator.ts`:
   ```typescript
   private generateYourAppType(): { files: Record<string, string> } {
     return {
       files: {
         'package.json': '...',
         'src/App.js': '...'
       }
     };
   }
   ```

3. Add test cases

4. Update documentation

## Documentation

- Update README.md for user-facing changes
- Update API documentation in docs/api-contracts.md
- Add examples in docs/examples.md
- Include inline code comments for complex logic
- Update architecture diagrams if needed

## Pull Request Process

1. Ensure all tests pass
2. Update documentation
3. Add a clear description of changes
4. Link related issues
5. Request review from maintainers
6. Address review feedback
7. Wait for approval and merge

## Commit Message Guidelines

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting)
- `refactor:` Code refactoring
- `test:` Adding or updating tests
- `chore:` Maintenance tasks

Examples:
```
feat: add support for Vue.js app generation
fix: resolve sandbox process cleanup issue
docs: update API examples for CSV viewer
```

## Code Review Guidelines

When reviewing PRs:
- Be respectful and constructive
- Check for code quality and style
- Verify tests are included
- Ensure documentation is updated
- Test the changes locally if possible

## Security

- Never commit secrets or API keys
- Report security vulnerabilities privately
- Follow security best practices
- Review changes for security implications

## Questions?

- Open an issue for bugs or feature requests
- Start a discussion for questions
- Check existing documentation first

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
