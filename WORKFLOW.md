# 🔄 Development-to-Production Workflow

This document outlines the streamlined workflow for developing locally and deploying to production.

## Quick Reference

### Local Development

```bash
# Initial setup
make setup                    # Install deps, create .env, start services
make dev-migrate              # Run database migrations

# Daily development
make dev-start                # Start database and Redis
cd backend && npm run dev     # Start backend (hot-reload)
cd frontend/mapx-frontend && npm run dev  # Start frontend (hot-reload)

# Or use the dev script
./dev.sh start                # Start services
./dev.sh logs                 # View logs
./dev.sh migrate             # Run migrations
```

### Production Deployment

```bash
# On production server
cd /opt/recce

# Update and deploy
./deploy-prod.sh update       # Git pull + rebuild all services
./deploy-prod.sh update-frontend  # Update only frontend
./deploy-prod.sh update-backend   # Update only backend

# Or use Makefile
make prod-update              # Update all services
make prod-update-frontend     # Update only frontend
```

## Workflow Overview

### 1. Local Development

**Setup (First Time):**
```bash
# Clone repository
git clone <repo-url>
cd mapx

# Set up environment
cp .env.example .env
# Edit .env with your values

# Install dependencies and start services
make setup
make dev-migrate
```

**Daily Development:**
```bash
# Start infrastructure
make dev-start

# In separate terminals:
cd backend && npm run dev
cd frontend/mapx-frontend && npm run dev
```

**Making Changes:**
1. Make code changes
2. Test locally
3. Commit changes: `git add . && git commit -m "Description"`
4. Push: `git push`

### 2. Production Deployment

**On Production Server:**

**Option A: Update Everything**
```bash
cd /opt/recce
./deploy-prod.sh update
```

**Option B: Update Specific Service**
```bash
# Only frontend changed
./deploy-prod.sh update-frontend

# Only backend changed
./deploy-prod.sh update-backend
```

**What Happens:**
1. ✅ Pre-deployment checks (git status, disk space)
2. 💾 Database backup created
3. 📥 Git pull (if in git repo)
4. 🔨 Service rebuild
5. 🏥 Health checks
6. 📝 Deployment logged

## File Structure

```
mapx/
├── dev.sh              # Local development script
├── deploy-prod.sh      # Production deployment script
├── deploy.sh           # Original deployment script (still works)
├── Makefile            # Convenience commands
├── .env.example        # Environment variables template
├── DEVELOPMENT.md      # Detailed development guide
├── WORKFLOW.md         # This file
└── docker-compose.yml  # Development Docker Compose
```

## Common Scenarios

### Scenario 1: New Feature Development

```bash
# 1. Create feature branch
git checkout -b feature/new-feature

# 2. Start development
make dev-start
cd backend && npm run dev  # Terminal 1
cd frontend/mapx-frontend && npm run dev  # Terminal 2

# 3. Make changes and test

# 4. Commit and push
git add .
git commit -m "Add new feature"
git push origin feature/new-feature

# 5. Merge to main, then deploy
```

### Scenario 2: Frontend-Only Change

```bash
# Local: Make changes, test
cd frontend/mapx-frontend
npm run dev

# Production: Update only frontend
./deploy-prod.sh update-frontend
```

### Scenario 3: Backend-Only Change

```bash
# Local: Make changes, test
cd backend
npm run dev

# Production: Update only backend
./deploy-prod.sh update-backend
```

### Scenario 4: Database Migration

```bash
# Local: Create and test migration
cd backend
npm run migrate:create add_new_table
# Edit migration file
npm run migrate

# Production: Deploy and run migration
./deploy-prod.sh update-backend
./deploy-prod.sh migrate
```

## Best Practices

### Before Deploying

1. ✅ Test changes locally
2. ✅ Run migrations locally
3. ✅ Check for uncommitted changes
4. ✅ Review logs: `./dev.sh logs`

### During Deployment

1. ✅ Monitor deployment: `./deploy-prod.sh logs`
2. ✅ Check health: `./deploy-prod.sh status`
3. ✅ Verify functionality after deployment

### After Deployment

1. ✅ Check application is working
2. ✅ Review deployment logs: `./deploy-prod.sh history`
3. ✅ Monitor for errors: `./deploy-prod.sh logs`

## Troubleshooting

### Deployment Failed

```bash
# Check logs
./deploy-prod.sh logs

# Check status
./deploy-prod.sh status

# View deployment history
./deploy-prod.sh history
```

### Rollback Needed

Currently, rollback requires manual steps:
1. Check deployment history: `./deploy-prod.sh history`
2. Find previous working commit
3. `git checkout <previous-commit>`
4. `./deploy-prod.sh deploy`

(Full rollback script coming in Phase 2)

## Scripts Reference

### dev.sh Commands

```bash
./dev.sh start [full]     # Start services
./dev.sh stop             # Stop services
./dev.sh logs [service]   # View logs
./dev.sh status           # Check status
./dev.sh migrate          # Run migrations
./dev.sh reset-db         # Reset database
./dev.sh clean            # Clean everything
./dev.sh install          # Install dependencies
```

### deploy-prod.sh Commands

```bash
./deploy-prod.sh deploy           # Full deployment
./deploy-prod.sh update           # Update all services
./deploy-prod.sh update-frontend   # Update frontend only
./deploy-prod.sh update-backend    # Update backend only
./deploy-prod.sh stop              # Stop services
./deploy-prod.sh logs [service]    # View logs
./deploy-prod.sh status            # Check status
./deploy-prod.sh migrate           # Run migrations
./deploy-prod.sh history           # View deployment history
```

### Makefile Commands

```bash
make help              # Show all commands
make dev-start         # Start dev services
make prod-update       # Update production
make install           # Install dependencies
make build             # Build for production
```

## Next Steps

- Read [DEVELOPMENT.md](./DEVELOPMENT.md) for detailed development guide
- Read [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for production setup
- Check [PRODUCTION_READINESS_CHECKLIST.md](./PRODUCTION_READINESS_CHECKLIST.md) for best practices

---

**Happy Developing! 🚀**




