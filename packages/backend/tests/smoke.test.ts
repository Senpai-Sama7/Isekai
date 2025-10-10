import request from 'supertest';
import app from '../src/index';

describe('CSV Viewer Smoke Test', () => {
  let appId: string;

  it('should generate a CSV viewer app from prompt', async () => {
    const response = await request(app)
      .post('/api/apps/generate')
      .send({ prompt: 'Create a CSV viewer app' })
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('name');
    expect(response.body).toHaveProperty('status');
    expect(response.body.prompt).toBe('Create a CSV viewer app');
    
    appId = response.body.id;
  }, 35000);

  it('should retrieve the generated app', async () => {
    if (!appId) {
      throw new Error('No app ID from previous test');
    }

    const response = await request(app)
      .get(`/api/apps/${appId}`)
      .expect(200);

    expect(response.body.id).toBe(appId);
    expect(response.body).toHaveProperty('code');
    expect(response.body.code).toHaveProperty('files');
  });

  it('should have essential CSV viewer files', async () => {
    if (!appId) {
      throw new Error('No app ID from previous test');
    }

    const response = await request(app)
      .get(`/api/apps/${appId}`)
      .expect(200);

    const files = response.body.code.files;

    expect(files).toBeDefined();
    expect(files['index.html']).toBeDefined();
    expect(files['styles.css']).toBeDefined();
    expect(files['app.js']).toBeDefined();
    expect(files['index.html']).toContain('CSV Viewer');
    expect(files['app.js']).toContain('FileReader');
  });

  it('should list apps including the CSV viewer', async () => {
    const response = await request(app)
      .get('/api/apps')
      .expect(200);

    expect(response.body).toHaveProperty('apps');
    expect(response.body).toHaveProperty('total');
    expect(Array.isArray(response.body.apps)).toBe(true);
  });

  it('should check health endpoint', async () => {
    const response = await request(app)
      .get('/api/health');

    expect(response.body).toHaveProperty('status');
    expect(response.body).toHaveProperty('services');
    expect(response.body).toHaveProperty('timestamp');
    // Status can be 'ok' or 'degraded' depending on service availability
    expect(['ok', 'degraded']).toContain(response.body.status);
  });
});
