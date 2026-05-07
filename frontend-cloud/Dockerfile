# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copiar archivos de dependencias
COPY package.json package-lock.json ./

# Instalar dependencias
RUN npm ci

# Copiar código fuente
COPY . .

# Build de la aplicación
ARG VITE_API_BASE=http://localhost:8000
ARG VITE_API_EMAIL=admin@cineverse.com
ARG VITE_API_PASSWORD=admin123

ENV VITE_API_BASE=${VITE_API_BASE}
ENV VITE_API_EMAIL=${VITE_API_EMAIL}
ENV VITE_API_PASSWORD=${VITE_API_PASSWORD}

RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Instalar servidor estático
RUN npm install -g serve

# Copiar archivos built del builder
COPY --from=builder /app/dist /app/dist

# Variables de entorno para runtime
ENV VITE_API_BASE=http://localhost:8000
ENV VITE_API_EMAIL=admin@cineverse.com
ENV VITE_API_PASSWORD=admin123

EXPOSE 5173

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5173', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

CMD ["serve", "-s", "dist", "-l", "5173"]
