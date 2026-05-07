FROM node:22-alpine

WORKDIR /app

# Install root-level concurrently (used by build script)
COPY package.json package-lock.json ./

# Install backend deps
COPY backend/package.json backend/package-lock.json backend/
RUN cd backend && npm ci --omit=dev

# Install frontend deps and build
COPY frontend/package.json frontend/package-lock.json frontend/
RUN cd frontend && npm ci
COPY frontend/ frontend/
RUN cd frontend && npm run build

# Copy backend source
COPY backend/ backend/

# Remove devDependencies from backend after build (keep it slim)
RUN cd backend && npm ci --omit=dev

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "backend/src/server.js"]