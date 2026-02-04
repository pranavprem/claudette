FROM node:20-slim

WORKDIR /app

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code@latest

# Install app dependencies
COPY package.json ./
RUN npm install

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

EXPOSE 8000

CMD ["node", "dist/server.js"]
