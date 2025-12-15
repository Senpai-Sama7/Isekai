import { promises as fs, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Database } from '../src/db/database';

type AppControllerType = import('../src/controllers/appController').AppController;
let AppControllerCtor: new () => AppControllerType;

describe('Local planner and sandbox integration', () => {
  const originalDbPath = process.env.DB_PATH;
  const originalSandboxRoot = process.env.SANDBOX_ROOT;
  const originalPlannerUrl = process.env.PLANNER_URL;
  const originalSandboxUrl = process.env.SANDBOX_URL;

  let tempDir: string;
  let controller: AppControllerType;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'isekai-backend-'));
    process.env.DB_PATH = join(tempDir, 'integration.db');
    process.env.SANDBOX_ROOT = join(tempDir, 'sandbox');
    process.env.PLANNER_URL = 'local';
    process.env.SANDBOX_URL = 'local';
    Database.resetInstance();
    ({ AppController: AppControllerCtor } = await import('../src/controllers/appController'));
    controller = new AppControllerCtor();
  });

  afterAll(async () => {
    Database.resetInstance();
    process.env.DB_PATH = originalDbPath;
    process.env.SANDBOX_ROOT = originalSandboxRoot;
    process.env.PLANNER_URL = originalPlannerUrl;
    process.env.SANDBOX_URL = originalSandboxUrl;
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('generates, updates, and cleans up an app locally', async () => {
    const app = await controller.generateApp('Create a CSV viewer named Finance Lens');

    expect(app.id).toBeDefined();
    if (!app.previewUrl) {
      throw new Error('Expected local sandbox execution to return a preview URL');
    }
    expect(app.previewUrl).toMatch(/^file:\/\//);

    const previewPath = app.previewUrl.replace('file://', '');
    const sandboxDir = join(process.env.SANDBOX_ROOT as string, app.id);

    const html = await fs.readFile(previewPath, 'utf8');
    expect(html).toContain('Finance Lens');
    expect(html).toContain('Upload a CSV file');

    const suggestions = await controller.trackAction(app.id, 'click', 'button', { text: 'Enable analytics' });
    expect(Array.isArray(suggestions)).toBe(true);
    expect(suggestions.length).toBeGreaterThan(0);

    const updated = await controller.applySuggestion(app.id, suggestions[0].id);
    expect(updated?.code.files['app.js']).toContain('[Analytics]');

    const logPath = join(sandboxDir, 'sandbox.log');
    const status = await fs.readFile(logPath, 'utf8');
    expect(status).toMatch(/Initialized app/);

    const deleted = await controller.deleteApp(app.id);
    expect(deleted).toBe(true);
    await expect(fs.access(sandboxDir)).rejects.toThrow();
  });
});
