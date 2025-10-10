import BetterSqlite3 from 'better-sqlite3';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';

export interface App {
  id: string;
  name: string;
  prompt: string;
  status: 'generating' | 'running' | 'stopped' | 'error';
  previewUrl?: string;
  code: string; // JSON stringified
  metadata: string; // JSON stringified
  createdAt: string;
  updatedAt: string;
}

export interface SuggestionRecord {
  id: string;
  appId: string;
  title: string;
  description: string;
  changes: Record<string, string>;
  createdAt: string;
}

export class Database {
  private static instance: Database | null = null;
  private db: BetterSqlite3.Database;
  private checkpointInterval?: NodeJS.Timeout;

  private constructor() {
    const dataDir = join(__dirname, '../../../data');
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }
    const dbPath = process.env.DB_PATH || join(dataDir, 'isekai.db');
    this.db = new BetterSqlite3(dbPath);
    
    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 5000');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = 1000000000');
    this.db.pragma('page_size = 4096');
    this.db.pragma('temp_store = MEMORY');
    
    this.initTables();
    this.setupCheckpointing();
  }

  static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  static resetInstance(): void {
    if (Database.instance) {
      Database.instance.close();
      Database.instance = null;
    }
  }

  private initTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS apps (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        prompt TEXT NOT NULL,
        status TEXT NOT NULL,
        previewUrl TEXT,
        code TEXT NOT NULL,
        metadata TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_apps_status ON apps(status);
      CREATE INDEX IF NOT EXISTS idx_apps_createdAt ON apps(createdAt DESC);

      CREATE TABLE IF NOT EXISTS suggestions (
        id TEXT PRIMARY KEY,
        appId TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        changes TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        FOREIGN KEY(appId) REFERENCES apps(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_suggestions_appId ON suggestions(appId);
    `);
  }

  private setupCheckpointing() {
    // Checkpoint WAL file every 5 minutes to prevent unbounded growth
    this.checkpointInterval = setInterval(() => {
      try {
        this.db.pragma('wal_checkpoint(PASSIVE)');
      } catch (error) {
        console.error('Error during WAL checkpoint:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  getDb(): BetterSqlite3.Database {
    return this.db;
  }

  createApp(app: App): App {
    const stmt = this.db.prepare(`
      INSERT INTO apps (id, name, prompt, status, previewUrl, code, metadata, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      app.id,
      app.name,
      app.prompt,
      app.status,
      app.previewUrl || null,
      app.code,
      app.metadata,
      app.createdAt,
      app.updatedAt
    );
    
    return app;
  }

  getApp(id: string): App | undefined {
    const stmt = this.db.prepare('SELECT * FROM apps WHERE id = ?');
    return stmt.get(id) as App | undefined;
  }

  listApps(limit: number = 10, offset: number = 0): { apps: App[]; total: number } {
    const stmt = this.db.prepare('SELECT * FROM apps ORDER BY createdAt DESC LIMIT ? OFFSET ?');
    const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM apps');
    
    const apps = stmt.all(limit, offset) as App[];
    const result = countStmt.get() as { count: number };
    
    return { apps, total: result.count };
  }

  updateApp(id: string, updates: Partial<App>): App | undefined {
    const app = this.getApp(id);
    if (!app) return undefined;

    const fields: string[] = [];
    const values: any[] = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'createdAt' && value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });

    if (fields.length === 0) return app;

    values.push(new Date().toISOString());
    fields.push('updatedAt = ?');
    values.push(id);

    const stmt = this.db.prepare(`UPDATE apps SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return this.getApp(id);
  }

  deleteApp(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM apps WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  saveSuggestions(appId: string, suggestions: SuggestionRecord[]): void {
    if (suggestions.length === 0) {
      this.clearSuggestions(appId);
      return;
    }

    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO suggestions (id, appId, title, description, changes, createdAt)
      VALUES (@id, @appId, @title, @description, @changes, @createdAt)
    `);

    const insertMany = this.db.transaction((records: SuggestionRecord[]) => {
      for (const suggestion of records) {
        insert.run({
          id: suggestion.id,
          appId,
          title: suggestion.title,
          description: suggestion.description,
          changes: JSON.stringify(suggestion.changes),
          createdAt: suggestion.createdAt
        });
      }
    });

    insertMany(suggestions);
  }

  getSuggestion(appId: string, suggestionId: string): SuggestionRecord | undefined {
    const stmt = this.db.prepare(
      'SELECT * FROM suggestions WHERE id = ? AND appId = ?'
    );
    const record = stmt.get(suggestionId, appId) as
      | (Omit<SuggestionRecord, 'changes'> & { changes: string })
      | undefined;

    if (!record) {
      return undefined;
    }

    return {
      id: record.id,
      appId: record.appId,
      title: record.title,
      description: record.description,
      createdAt: record.createdAt,
      changes: JSON.parse(record.changes)
    };
  }

  clearSuggestions(appId: string): void {
    const stmt = this.db.prepare('DELETE FROM suggestions WHERE appId = ?');
    stmt.run(appId);
  }

  close(): void {
    if (this.checkpointInterval) {
      clearInterval(this.checkpointInterval);
    }
    this.db.close();
  }
}
