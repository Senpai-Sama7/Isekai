import Docker from 'dockerode';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as tmp from 'tmp';
import { GeneratedApp } from '@isekai/types';
import { winstonLogger } from '../utils/logger';

export class SandboxManager {
  private docker: Docker;
  private sandboxDir: string;

  constructor() {
    this.docker = new Docker();
    this.sandboxDir = tmp.dirSync({ unsafeCleanup: true }).name;
  }

  async createSandbox(sandboxId: string, app: GeneratedApp): Promise<any> {
    winstonLogger.info('Creating sandbox', { sandboxId, appId: app.id });

    const appDir = path.join(this.sandboxDir, sandboxId);
    await fs.ensureDir(appDir);

    // Write application files
    await this.writeAppFiles(appDir, app.files);

    // Create Dockerfile
    await this.createDockerfile(appDir, app);

    // Build Docker image
    const imageName = `imagine-app-${sandboxId}`;
    await this.buildDockerImage(appDir, imageName);

    // Create and start container
    const container = await this.docker.createContainer({
      Image: imageName,
      name: `imagine-sandbox-${sandboxId}`,
      WorkingDir: '/app',
      Env: [
        'NODE_ENV=production',
        'PORT=3000',
        'SANDBOX_ID=' + sandboxId
      ],
      ExposedPorts: {
        '3000/tcp': {}
      },
      HostConfig: {
        Memory: 512 * 1024 * 1024, // 512MB
        CpuQuota: 50000, // 0.5 CPU
        NetworkMode: 'none', // No network access
        ReadonlyRootfs: true,
        Tmpfs: {
          '/tmp': 'rw,noexec,nosuid,size=100m'
        },
        SecurityOpt: [
          'no-new-privileges:true',
          'seccomp=unconfined'
        ],
        DropCapabilities: [
          'ALL'
        ],
        CapAdd: [
          'CHOWN',
          'DAC_OVERRIDE',
          'FOWNER',
          'SETGID',
          'SETUID'
        ]
      },
      User: 'node'
    });

    return {
      container,
      appDir,
      imageName
    };
  }

  async destroySandbox(sandbox: any): Promise<void> {
    try {
      // Stop and remove container
      if (sandbox.container) {
        try {
          await sandbox.container.kill();
        } catch (error) {
          // Container might already be stopped
        }
        
        try {
          await sandbox.container.remove({ force: true });
        } catch (error) {
          // Container might already be removed
        }
      }

      // Remove Docker image
      if (sandbox.imageName) {
        try {
          const image = this.docker.getImage(sandbox.imageName);
          await image.remove({ force: true });
        } catch (error) {
          // Image might not exist
        }
      }

      // Clean up app directory
      if (sandbox.appDir) {
        await fs.remove(sandbox.appDir);
      }

      winstonLogger.info('Sandbox destroyed successfully');
    } catch (error) {
      winstonLogger.error('Failed to destroy sandbox', error);
    }
  }

  private async writeAppFiles(appDir: string, files: any[]): Promise<void> {
    for (const file of files) {
      const filePath = path.join(appDir, file.path);
      const fileDir = path.dirname(filePath);
      
      await fs.ensureDir(fileDir);
      await fs.writeFile(filePath, file.content, 'utf8');
    }
  }

  private async createDockerfile(appDir: string, app: GeneratedApp): Promise<void> {
    const dockerfileContent = `
FROM node:18-alpine

# Install system dependencies
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Set Puppeteer to use installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \\
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application files
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Change ownership of the app directory
RUN chown -R nextjs:nodejs /app
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD node healthcheck.js

# Start the application
CMD ["npm", "start"]
`;

    await fs.writeFile(path.join(appDir, 'Dockerfile'), dockerfileContent);

    // Create healthcheck script
    const healthcheckContent = `
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/health',
  method: 'GET',
  timeout: 2000
};

const req = http.request(options, (res) => {
  if (res.statusCode === 200) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

req.on('error', () => {
  process.exit(1);
});

req.on('timeout', () => {
  req.destroy();
  process.exit(1);
});

req.end();
`;

    await fs.writeFile(path.join(appDir, 'healthcheck.js'), healthcheckContent);
  }

  private async buildDockerImage(appDir: string, imageName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      winstonLogger.info('Building Docker image', { imageName });

      this.docker.buildImage({
        context: appDir,
        src: ['.']
      }, { t: imageName }, (err, stream) => {
        if (err) {
          reject(err);
          return;
        }

        stream.on('data', (chunk) => {
          const log = chunk.toString();
          try {
            const data = JSON.parse(log);
            if (data.error) {
              reject(new Error(data.error));
              return;
            }
            if (data.stream) {
              winstonLogger.info('Docker build', { log: data.stream.trim() });
            }
          } catch (e) {
            // Ignore JSON parse errors
          }
        });

        stream.on('end', () => {
          winstonLogger.info('Docker image built successfully', { imageName });
          resolve();
        });

        stream.on('error', reject);
      });
    });
  }
}