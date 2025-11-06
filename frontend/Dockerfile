# Production Dockerfile for Frontend

# Build stage
FROM node:20-alpine as build

WORKDIR /app

# Copy package files from mapx-frontend subdirectory
COPY mapx-frontend/package*.json ./
RUN npm ci

# Copy source code from mapx-frontend
COPY mapx-frontend/ .

# Build-time API base URL for the frontend. Default to "/api" to match nginx proxy.
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Build-time backend URL for OAuth redirects
ARG VITE_BACKEND_URL=http://localhost:5000
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL

# Build-time Google Maps API key
ARG VITE_GOOGLE_MAPS_API_KEY
ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY

# Build the React app (production mode)
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the built React app to Nginx's public directory
# Note: Vite outputs to 'dist', not 'build'
COPY --from=build /app/dist /usr/share/nginx/html

# Expose the default Nginx port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1/health || exit 1

# Command to start Nginx
CMD ["nginx", "-g", "daemon off;"]