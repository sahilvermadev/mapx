# Makefile for RECCE Application
# Provides convenient shortcuts for common development and deployment tasks

.PHONY: help dev-start dev-stop dev-logs dev-status dev-migrate dev-clean dev-reset
.PHONY: prod-deploy prod-update prod-stop prod-logs prod-status prod-migrate
.PHONY: install test build clean

# Default target
help:
	@echo "RECCE Application - Makefile Commands"
	@echo "====================================="
	@echo ""
	@echo "Development Commands:"
	@echo "  make dev-start      - Start development services (db, redis)"
	@echo "  make dev-start-full - Start all services including backend"
	@echo "  make dev-stop       - Stop all development services"
	@echo "  make dev-logs       - View logs from all services"
	@echo "  make dev-status     - Check service status"
	@echo "  make dev-migrate    - Run database migrations"
	@echo "  make dev-reset      - Reset database (⚠️ deletes data)"
	@echo "  make dev-clean      - Remove all containers and volumes"
	@echo ""
	@echo "Production Commands:"
	@echo "  make prod-deploy    - Full production deployment"
	@echo "  make prod-update    - Update production (git pull + rebuild)"
	@echo "  make prod-stop      - Stop production services"
	@echo "  make prod-logs      - View production logs"
	@echo "  make prod-status    - Check production service status"
	@echo "  make prod-migrate   - Run production migrations"
	@echo ""
	@echo "General Commands:"
	@echo "  make install       - Install all dependencies"
	@echo "  make build         - Build backend and frontend"
	@echo "  make clean         - Clean build artifacts"
	@echo "  make help          - Show this help message"
	@echo ""

# ============================================
# Development Commands
# ============================================

dev-start:
	@./dev.sh start

dev-start-infra:
	@./dev.sh start infra

dev-stop:
	@./dev.sh stop

dev-logs:
	@./dev.sh logs

dev-status:
	@./dev.sh status

dev-migrate:
	@./dev.sh migrate

dev-reset:
	@./dev.sh reset-db

dev-clean:
	@./dev.sh clean

# ============================================
# Production Commands
# ============================================

prod-deploy:
	@./deploy-prod.sh deploy

prod-update:
	@./deploy-prod.sh update

prod-update-frontend:
	@./deploy-prod.sh update-frontend

prod-update-backend:
	@./deploy-prod.sh update-backend

prod-stop:
	@./deploy-prod.sh stop

prod-logs:
	@./deploy-prod.sh logs

prod-status:
	@./deploy-prod.sh status

prod-migrate:
	@./deploy-prod.sh migrate

prod-history:
	@./deploy-prod.sh history

# ============================================
# General Commands
# ============================================

install:
	@echo "Installing dependencies..."
	@./dev.sh install

build:
	@echo "Building backend..."
	@cd backend && npm run build
	@echo "Building frontend..."
	@cd frontend/mapx-frontend && npm run build
	@echo "✅ Build complete!"

clean:
	@echo "Cleaning build artifacts..."
	@rm -rf backend/dist
	@rm -rf frontend/mapx-frontend/dist
	@echo "✅ Clean complete!"

# ============================================
# Quick Development Setup
# ============================================

setup: install
	@echo "Setting up development environment..."
	@if [ ! -f .env ]; then \
		echo "Creating .env from .env.example..."; \
		cp .env.example .env; \
		echo "⚠️  Please update .env with your configuration!"; \
	fi
	@./dev.sh start
	@echo "✅ Development environment ready!"
	@echo "Next steps:"
	@echo "  1. Update .env with your configuration"
	@echo "  2. Run migrations: make dev-migrate"
	@echo "  3. Start backend: cd backend && npm run dev"
	@echo "  4. Start frontend: cd frontend/mapx-frontend && npm run dev"

