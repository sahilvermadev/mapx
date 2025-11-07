# 🛠️ Development Guide

This guide covers local development setup and workflow for the REKKY application.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Development Workflow](#development-workflow)
4. [Running Services](#running-services)
5. [Common Tasks](#common-tasks)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **Docker** and **Docker Compose** ([Install Docker](https://docs.docker.com/get-docker/))
- **Git** ([Download](https://git-scm.com/downloads))

### Verify Installation

```bash
node --version    # Should be 18.x or higher
docker --version  # Should be 20.x or higher
docker compose version  # Should be 2.x or higher
git --version
```

---

## Quick Start (5 minutes)

### 1. Clone and Setup

```bash
# Clone the repository
git clone <repository-url>
cd mapx

# Copy environment file
cp .env.example .env

# Edit .env with your values (at minimum):
# - DB_PASSWORD (any secure password)
# - JWT_SECRET (generate: openssl rand -base64 32)
# - SESSION_SECRET (generate: openssl rand -base64 32)
# - GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (can use test values for dev)
```

### 2. Install Dependencies

```bash
# Install all dependencies (backend + frontend)
./dev.sh install

# Or manually:
cd backend && npm install && cd ..
cd frontend/mapx-frontend && npm install && cd ../..
```

### 3. Start All Services in Docker (Recommended)

**All services now run in Docker to match production environment!**

```bash
# Start all services in Docker (recommended - matches production)
./dev.sh start

# Or using Makefile:
make dev-start
```

This starts:
- Database (PostgreSQL)
- Redis
- Backend (with hot-reload)
- Frontend (with hot-reload)

**That's it!** All services run in Docker with hot-reload enabled.

### 4. Run Migrations

```bash
./dev.sh migrate

# Or:
make dev-migrate
```

### 5. Access Your Application

Open your browser to:
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:5000

## Docker vs Manual Development

### Docker Development (Recommended) ✅

**Benefits:**
- ✅ Environment Parity - Local matches production exactly
- ✅ Easy Setup - One command starts everything
- ✅ Hot Reload - Code changes reflect immediately
- ✅ No Local Dependencies - Don't need Node.js installed locally
- ✅ Consistent - Same Docker setup as production

**How it works:**
- Code is mounted from your local filesystem into containers
- Backend uses `ts-node-dev` for automatic restarts on file changes
- Frontend uses Vite HMR (Hot Module Replacement)
- Changes reflect immediately in browser

### Manual Development (Alternative)

If you prefer to run backend/frontend locally:

```bash
# Start only database and Redis
./dev.sh start infra
# Or:
make dev-start-infra

# In separate terminals:
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend/mapx-frontend && npm run dev
```

This gives you:
- ✅ Hot-reload for both backend and frontend
- ✅ Direct access to logs in your terminal
- ✅ Faster iteration (no Docker rebuilds needed)
- ✅ Better debugging experience
- ⚠️ Different from production environment

---

## Development Workflow

### Using the Development Script

We provide a `dev.sh` script to simplify common development tasks:

```bash
# Start services
./dev.sh start          # Start only database and Redis
./dev.sh start full     # Start all services including backend

# Stop services
./dev.sh stop

# View logs
./dev.sh logs           # All services
./dev.sh logs backend   # Specific service

# Check status
./dev.sh status

# Run migrations
./dev.sh migrate

# Reset database (⚠️ removes all data)
./dev.sh reset-db

# Clean up everything
./dev.sh clean
```

### Manual Development Workflow

If you prefer to run services manually:

1. **Start infrastructure services:**
   ```bash
   docker compose up -d db redis
   ```

2. **Run backend locally (with hot-reload):**
   ```bash
   cd backend
   npm run dev
   ```

3. **Run frontend locally (with hot-reload):**
   ```bash
   cd frontend/mapx-frontend
   npm run dev
   ```

This approach gives you:
- ✅ Hot-reload for both backend and frontend
- ✅ Direct access to logs in your terminal
- ✅ Faster iteration (no Docker rebuilds needed)
- ✅ Better debugging experience

---

## Running Services

After `./dev.sh start`, these services run:

| Service | URL | Port | Hot Reload |
|---------|-----|------|------------|
| Frontend | http://localhost:5173 | 5173 | ✅ Yes |
| Backend API | http://localhost:5000 | 5000 | ✅ Yes |
| Database | localhost | 5432 | - |
| Redis | localhost | 6379 | - |
| pgAdmin | http://localhost:8080 | 8080 | - |

### Database (PostgreSQL with PostGIS)

- **Port:** `5432`
- **Connection:** `postgresql://DB_USER:DB_PASSWORD@localhost:5432/DB_NAME`
- **Access via Docker:**
  ```bash
  docker exec -it rekky_db_container psql -U appuser -d rekky_db
  ```
- **Or use helper script:**
  ```bash
  ./db-access.sh
  ```

### Redis

- **Port:** `6379`
- **Connection:** `redis://localhost:6379`
- **Access via Docker:**
  ```bash
  docker exec -it rekky_redis_container redis-cli
  ```

### Backend API

- **URL:** `http://localhost:5000`
- **Health Check:** `http://localhost:5000/health`
- **API Docs:** Check `backend/src/routes/` for available endpoints

### Frontend

- **URL:** `http://localhost:5173`
- **Hot-reload:** Enabled automatically via Vite HMR

### pgAdmin (Optional - Local Development Only)

- **URL:** `http://localhost:8080`
- **Email:** `admin@rekky.com`
- **Password:** `admin123` (change in docker-compose.yml)
- **Note:** pgAdmin is only available in local development, not in production

---

## Common Tasks

### Running Database Migrations

```bash
# Using dev script
./dev.sh migrate

# Or manually
cd backend
npm run migrate
```

### Creating a New Migration

```bash
cd backend
npm run migrate:create migration_name
```

### Accessing the Database

**Via Docker:**
```bash
docker exec -it rekky_db_container psql -U appuser -d rekky_db
```

**Via psql (if installed locally):**
```bash
psql -h localhost -U appuser -d rekky_db
```

### Viewing Logs

```bash
# All services
./dev.sh logs

# Specific service
./dev.sh logs backend
./dev.sh logs db

# Or using docker compose directly
docker compose logs -f backend
```

### Resetting the Database

⚠️ **Warning:** This will delete all data!

```bash
./dev.sh reset-db
```

Then run migrations again:
```bash
./dev.sh migrate
```

### Installing Dependencies

```bash
# Install all dependencies
./dev.sh install

# Or manually
cd backend && npm install
cd ../frontend/mapx-frontend && npm install
```

### Building for Production (Local Test)

```bash
# Backend
cd backend
npm run build
npm start

# Frontend
cd frontend/mapx-frontend
npm run build
npm run preview
```

---

## Project Structure

```
mapx/
├── backend/              # Backend API (Node.js/Express/TypeScript)
│   ├── src/             # Source code
│   ├── migrations/      # Database migrations
│   └── package.json
├── frontend/
│   └── mapx-frontend/   # Frontend (React/Vite/TypeScript)
│       ├── src/         # Source code
│       └── package.json
├── docker-compose.yml   # Development Docker Compose
├── docker-compose.prod.yml  # Production Docker Compose
├── dev.sh              # Development workflow script
├── deploy-prod.sh      # Production deployment script
└── .env.example        # Environment variables template
```

---

## Development Tips

### Hot Reload

- **Backend:** Uses `ts-node-dev` for automatic restarts on file changes
- **Frontend:** Vite provides instant HMR (Hot Module Replacement)

### Debugging

**Backend:**
- Use `console.log()` or `console.error()` (logs appear in terminal)
- Use VS Code debugger with launch configuration
- Check `backend/src/utils/logger.ts` for structured logging

**Frontend:**
- Use browser DevTools
- React DevTools extension recommended
- Check browser console for errors

### Environment Variables

- **Backend:** Loaded from `.env` in project root
- **Frontend:** Variables prefixed with `VITE_` are available at build time
- **Docker:** Environment variables from `.env` are passed to containers

### Database Changes

1. Create a migration: `cd backend && npm run migrate:create migration_name`
2. Write migration SQL in the generated file
3. Run migration: `npm run migrate`
4. Test your changes

### API Testing

Use tools like:
- **Postman** or **Insomnia** for API testing
- **curl** for quick tests:
  ```bash
  curl http://localhost:5000/health
  ```

---

## Troubleshooting

### Port Already in Use

**Error:** `Error: listen EADDRINUSE: address already in use :::5000`

**Solution:**
```bash
# Find process using the port
lsof -i :5000  # macOS/Linux
netstat -ano | findstr :5000  # Windows

# Kill the process or change PORT in .env
```

### Database Connection Failed

**Error:** `Error: connect ECONNREFUSED 127.0.0.1:5432`

**Solution:**
```bash
# Check if database is running
./dev.sh status

# Start database
./dev.sh start

# Verify connection
docker exec -it rekky_db_container pg_isready -U appuser
```

### Docker Issues

**Error:** `Cannot connect to the Docker daemon`

**Solution:**
```bash
# Start Docker Desktop (macOS/Windows)
# Or start Docker service (Linux)
sudo systemctl start docker
```

### Frontend Can't Connect to Backend

**Error:** CORS errors or connection refused

**Solution:**
1. Check `ALLOWED_ORIGINS` in `.env` includes `http://localhost:5173`
2. Verify backend is running: `curl http://localhost:5000/health`
3. Check `VITE_API_BASE_URL` in frontend environment

### Migration Errors

**Error:** Migration fails or database is out of sync

**Solution:**
```bash
# Check migration status
cd backend
npm run migrate

# If needed, reset database (⚠️ deletes data)
./dev.sh reset-db
./dev.sh migrate
```

### Node Modules Issues

**Error:** Module not found or version conflicts

**Solution:**
```bash
# Clean install
rm -rf node_modules package-lock.json
cd backend && rm -rf node_modules package-lock.json && cd ..
cd frontend/mapx-frontend && rm -rf node_modules package-lock.json && cd ../..
./dev.sh install
```

---

## Next Steps

- Read [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for production deployment
- Check [PRODUCTION_READINESS_CHECKLIST.md](./PRODUCTION_READINESS_CHECKLIST.md) for production best practices
- Review [docs/](./docs/) for detailed documentation

---

## Getting Help

- Check logs: `./dev.sh logs`
- Review error messages in terminal
- Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues
- Review service status: `./dev.sh status`

---

**Happy Coding! 🚀**




