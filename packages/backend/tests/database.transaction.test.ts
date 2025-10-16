import { randomUUID } from 'crypto';
import { Database, App } from '../src/db/database';

const baseApp = (): App => {
  const id = randomUUID();
  const now = new Date().toISOString();

  return {
    id,
    name: `App ${id.slice(0, 8)}`,
    prompt: 'generate something',
    status: 'running',
    code: JSON.stringify({ files: { 'index.ts': '// noop' } }),
    metadata: JSON.stringify({}),
    createdAt: now,
    updatedAt: now
  };
};

describe('Database transactions (synchronous)', () => {
  beforeAll(() => {
    process.env.DB_PATH = ':memory:';
  });

  afterAll(() => {
    delete process.env.DB_PATH;
    Database.resetInstance();
  });

  beforeEach(() => {
    Database.resetInstance();
  });

  it('commits all operations when the transaction completes', () => {
    const db = Database.getInstance();
    const newApp = baseApp();

    const saved = db.transaction(() => db.createApp(newApp));

    expect(saved.id).toEqual(newApp.id);
    const loaded = db.getApp(newApp.id);
    expect(loaded).toBeDefined();
    expect(loaded?.name).toEqual(newApp.name);
  });

  it('rolls back all work when the transaction throws', () => {
    const db = Database.getInstance();
    const failingApp = baseApp();

    expect(() =>
      db.transaction(() => {
        db.createApp(failingApp);
        throw new Error('force rollback');
      })
    ).toThrow('force rollback');

    const loaded = db.getApp(failingApp.id);
    expect(loaded).toBeUndefined();
  });
});
