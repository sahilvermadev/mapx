# Troubleshooting Backend Container Issues

## Check Backend Logs

If the backend container is failing to start, check the logs:

```bash
docker logs recce_backend_prod
```

Or follow the logs in real-time:

```bash
docker logs -f recce_backend_prod
```

## Common Issues

### 1. Environment Variables Missing

Check if all required environment variables are set in `.env`:

```bash
cat .env | grep -E "DB_|JWT_|GOOGLE_|SESSION_"
```

### 2. Database Connection Issues

Test database connection from the backend container:

```bash
docker exec -it recce_backend_prod node -e "require('pg').Pool({connectionString: process.env.DATABASE_URL}).query('SELECT 1', (err, res) => {if(err) console.error(err); else console.log('DB OK'); process.exit(err ? 1 : 0)})"
```

### 3. Health Check Issues

Manually test the health endpoint:

```bash
docker exec -it recce_backend_prod node /app/healthcheck.js
```

Or test from outside the container:

```bash
curl http://localhost:5000/health
```

### 4. Check Container Status

```bash
docker ps -a | grep recce_backend_prod
docker inspect recce_backend_prod | grep -A 10 Health
```

### 5. Restart Services

If needed, restart the backend:

```bash
docker restart recce_backend_prod
```

Or restart all services:

```bash
./deploy.sh restart
```

