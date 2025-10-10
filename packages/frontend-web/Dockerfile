FROM node:20-alpine
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY package.json pnpm-lock.yaml* package-lock.json* ./
RUN set -eux;     if [ -f pnpm-lock.yaml ]; then corepack enable && corepack prepare pnpm@latest --activate && pnpm install --frozen-lockfile;     elif [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY . .
USER app
EXPOSE 3000
HEALTHCHECK CMD wget -qO- http://localhost:3000/health || exit 1
CMD [ "npm", "run", "start" ]
