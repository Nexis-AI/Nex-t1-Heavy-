# Docker Configuration for Nex-t1 Heavy

This document describes the Docker setup for the Nex-t1 Heavy Multi-Agent System.

## Overview

The system uses Docker and Docker Compose for containerization, providing both production and development configurations.

## Files Structure

```
.
├── Dockerfile              # Production multi-stage build
├── Dockerfile.dev          # Development build with hot-reloading
├── docker-compose.yml      # Production compose configuration
├── docker-compose.dev.yml  # Development compose configuration
├── .dockerignore          # Files to exclude from Docker context
└── scripts/
    └── docker-init.sh     # Initialization script
```

## Quick Start

### Development Environment

```bash
# Start all services
docker-compose -f docker-compose.dev.yml up

# Start with additional tools (Prisma Studio, Redis Commander)
docker-compose -f docker-compose.dev.yml --profile tools up

# Rebuild after dependency changes
docker-compose -f docker-compose.dev.yml up --build
```

### Production Environment

```bash
# Build and start all services
docker-compose up -d

# Start with monitoring stack
docker-compose --profile monitoring up -d

# Start with Nginx reverse proxy
docker-compose --profile with-nginx up -d

# View logs
docker-compose logs -f app
```

## Services

### Core Services

1. **app** - Main NestJS application
   - Port 3000: API endpoints
   - Port 9090: Prometheus metrics
   - Port 9229: Node.js debugger (dev only)

2. **redis** - Message bus and caching
   - Port 6379: Redis server

3. **postgres** - Primary database
   - Port 5432: PostgreSQL server

### Optional Services

4. **nginx** - Reverse proxy (production)
   - Port 80: HTTP (redirects to HTTPS)
   - Port 443: HTTPS

5. **prometheus** - Metrics collection
   - Port 9091: Prometheus UI

6. **grafana** - Metrics visualization
   - Port 3001: Grafana UI
   - Default credentials: admin/admin

7. **prisma-studio** - Database GUI (dev)
   - Port 5555: Prisma Studio

8. **redis-commander** - Redis GUI (dev)
   - Port 8081: Redis Commander

## Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
# Edit .env with your configuration
```

### SSL Certificates

For HTTPS support with Nginx:

```bash
# Create SSL directory
mkdir -p nginx/ssl

# Generate self-signed certificate (development)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/key.pem \
  -out nginx/ssl/cert.pem

# Or copy your production certificates
cp /path/to/cert.pem nginx/ssl/
cp /path/to/key.pem nginx/ssl/
```

## Common Commands

### Database Management

```bash
# Run migrations
docker-compose exec app npx prisma migrate deploy

# Create new migration
docker-compose exec app npx prisma migrate dev --name migration_name

# Open Prisma Studio
docker-compose -f docker-compose.dev.yml --profile tools up prisma-studio
```

### Monitoring

```bash
# Access Prometheus
open http://localhost:9091

# Access Grafana
open http://localhost:3001

# Check application metrics
curl http://localhost:9090/metrics
```

### Debugging

```bash
# View logs
docker-compose logs -f app

# Access container shell
docker-compose exec app sh

# Check Redis
docker-compose exec redis redis-cli

# Check PostgreSQL
docker-compose exec postgres psql -U nexai -d nex_t1_heavy
```

## Production Deployment

### Building Images

```bash
# Build production image
docker build -t nex-t1-heavy:latest .

# Tag for registry
docker tag nex-t1-heavy:latest your-registry/nex-t1-heavy:latest

# Push to registry
docker push your-registry/nex-t1-heavy:latest
```

### Deployment with Docker Swarm

```bash
# Initialize swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.yml nex-t1

# Scale services
docker service scale nex-t1_app=3
```

### Deployment with Kubernetes

See `/k8s` directory for Kubernetes manifests (if available).

## Health Checks

The application includes health check endpoints:

- `/health` - Basic health check
- `/health/live` - Liveness probe
- `/health/ready` - Readiness probe

Docker Compose uses these for container health monitoring.

## Security Considerations

1. **Non-root User**: Containers run as non-root user (nodejs:1001)
2. **Read-only Root**: Consider adding `read_only: true` in production
3. **Secrets Management**: Use Docker secrets or external secret management
4. **Network Isolation**: Services communicate through internal networks
5. **Resource Limits**: CPU and memory limits are configured

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs app

# Verify environment variables
docker-compose config

# Check file permissions
ls -la logs/ uploads/
```

### Database Connection Issues

```bash
# Test database connection
docker-compose exec app npx prisma db pull

# Check PostgreSQL logs
docker-compose logs postgres
```

### Performance Issues

```bash
# Check resource usage
docker stats

# Increase limits in docker-compose.yml
deploy:
  resources:
    limits:
      cpus: '4'
      memory: 4G
```

## Backup and Restore

### Database Backup

```bash
# Backup
docker-compose exec postgres pg_dump -U nexai nex_t1_heavy > backup.sql

# Restore
docker-compose exec -T postgres psql -U nexai nex_t1_heavy < backup.sql
```

### Volume Backup

```bash
# Backup volumes
docker run --rm -v nex-t1-heavy_postgres-data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-backup.tar.gz -C /data .

# Restore volumes
docker run --rm -v nex-t1-heavy_postgres-data:/data -v $(pwd):/backup alpine tar xzf /backup/postgres-backup.tar.gz -C /data
```

## Maintenance

### Updating Dependencies

```bash
# Update base images
docker-compose pull

# Rebuild with latest dependencies
docker-compose build --no-cache
```

### Cleaning Up

```bash
# Stop and remove containers
docker-compose down

# Remove volumes (WARNING: deletes data)
docker-compose down -v

# Clean up unused resources
docker system prune -a
```