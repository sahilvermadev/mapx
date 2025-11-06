# Database Access Guide

This guide explains how to access and inspect your production database.

## 🎯 Quick Access Options

1. **pgAdmin (Web UI)** - Easiest for visual browsing (recommended)
2. **psql (Command Line)** - Fast for quick queries
3. **Docker exec** - Direct database commands

---

## Method 0: pgAdmin Web Interface (Recommended) 🎨

pgAdmin provides a user-friendly web interface for database management.

### Setup (First Time Only)

1. **Add pgAdmin credentials to `.env`** (optional, for security):
```bash
PGADMIN_EMAIL=admin@recce.com
PGADMIN_PASSWORD=your_secure_password_here
```

2. **Start pgAdmin**:
```bash
docker compose -f docker-compose.prod.yml up -d pgadmin
```

3. **Access pgAdmin**:
   - **Option A: Direct access** (if on the server):
     - Open: `http://localhost:8080` or `http://your-server-ip:8080`
   - **Option B: SSH Tunnel** (recommended for security):
     ```bash
     # From your local machine
     ssh -L 8080:localhost:8080 user@your-server-ip
     # Then open: http://localhost:8080
     ```

4. **Login to pgAdmin**:
   - Email: `admin@recce.com` (or your `PGADMIN_EMAIL`)
   - Password: `change_me_in_production` (or your `PGADMIN_PASSWORD`)

5. **Connect to Database**:
   - Right-click "Servers" → "Register" → "Server..."
   - **General Tab:**
     - Name: `Recce Production DB`
   - **Connection Tab:**
     - Host name/address: `db` (Docker service name)
     - Port: `5432`
     - Maintenance database: `recce_db` (or your `DB_NAME`)
     - Username: `recce_user` (or your `DB_USER`)
     - Password: Your `DB_PASSWORD` from `.env`
     - ✅ Save password (check this)
   - Click "Save"

### Using pgAdmin

- **View Tables**: Navigate to `Recce Production DB` → `Schemas` → `public` → `Tables`
- **View Data**: Click any table → "Data" tab
- **Run Queries**: Click "SQL" tab → write queries → Execute
- **View Structure**: Click table → "Columns" tab

### Security Note

⚠️ **For Production**: Consider using an SSH tunnel to access pgAdmin instead of exposing port 8080 publicly. You can also restrict access using firewall rules.

---

## Quick Access Methods (Command Line)

### Method 1: Direct psql Access (Recommended)

Connect to the database container and use `psql`:

```bash
# Connect to the database
docker exec -it recce_db_prod psql -U recce_user -d recce_db
```

Once connected, you can run SQL commands:

```sql
-- List all tables
\dt

-- List all tables with schemas
\dt+

-- Describe a specific table
\d table_name

-- List all schemas
\dn

-- List all databases
\l

-- Show table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Count rows in a table
SELECT COUNT(*) FROM table_name;

-- View table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'table_name';

-- Exit psql
\q
```

### Method 2: Run Single Commands

Execute SQL commands without entering interactive mode:

```bash
# List all tables
docker exec -it recce_db_prod psql -U recce_user -d recce_db -c "\dt"

# Count rows in a specific table
docker exec -it recce_db_prod psql -U recce_user -d recce_db -c "SELECT COUNT(*) FROM recommendations;"

# View table structure
docker exec -it recce_db_prod psql -U recce_user -d recce_db -c "\d recommendations"

# Run a custom query
docker exec -it recce_db_prod psql -U recce_user -d recce_db -c "SELECT id, title, created_at FROM recommendations LIMIT 10;"
```

### Method 3: Export Database Schema

```bash
# Export schema only (no data)
docker exec recce_db_prod pg_dump -U recce_user -d recce_db --schema-only > schema.sql

# Export specific table
docker exec recce_db_prod pg_dump -U recce_user -d recce_db -t table_name > table_name.sql

# Export full database (structure + data)
docker exec recce_db_prod pg_dump -U recce_user -d recce_db > full_backup.sql
```

## Common Database Queries

### Check Database Size

```bash
docker exec -it recce_db_prod psql -U recce_user -d recce_db -c "
SELECT 
    pg_database.datname,
    pg_size_pretty(pg_database_size(pg_database.datname)) AS size
FROM pg_database
WHERE datname = 'recce_db';
"
```

### List All Tables with Row Counts

```bash
docker exec -it recce_db_prod psql -U recce_user -d recce_db -c "
SELECT 
    schemaname,
    tablename,
    (SELECT COUNT(*) FROM information_schema.tables t2 
     WHERE t2.table_schema = t1.schemaname 
     AND t2.table_name = t1.tablename) as row_count
FROM pg_tables t1
WHERE schemaname = 'public'
ORDER BY tablename;
"
```

### Check Recent Migrations

```bash
docker exec -it recce_db_prod psql -U recce_user -d recce_db -c "
SELECT * FROM pgmigrations 
ORDER BY run_on DESC 
LIMIT 10;
"
```

### View Table Indexes

```bash
docker exec -it recce_db_prod psql -U recce_user -d recce_db -c "
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
"
```

### Check Active Connections

```bash
docker exec -it recce_db_prod psql -U recce_user -d recce_db -c "
SELECT 
    pid,
    usename,
    application_name,
    client_addr,
    state,
    query_start,
    state_change
FROM pg_stat_activity
WHERE datname = 'recce_db';
"
```

## Useful psql Commands Reference

| Command | Description |
|---------|-------------|
| `\dt` | List all tables |
| `\dt+` | List tables with additional info |
| `\d table_name` | Describe table structure |
| `\d+ table_name` | Describe table with detailed info |
| `\di` | List indexes |
| `\dv` | List views |
| `\df` | List functions |
| `\dn` | List schemas |
| `\l` | List all databases |
| `\c database_name` | Connect to a different database |
| `\x` | Toggle expanded display (vertical output) |
| `\timing` | Toggle query execution time |
| `\q` | Quit psql |

## Security Notes

⚠️ **Important**: The production database is not exposed to the host (port 5432 is not mapped) for security. This means:

- ✅ You can only access it from within the Docker network
- ✅ You must use `docker exec` or pgAdmin (which runs inside Docker) to connect
- ✅ No external connections are possible (more secure)

### pgAdmin Security Recommendations

1. **Change default password**: Set `PGADMIN_PASSWORD` in `.env` to a strong password:
   ```bash
   PGADMIN_EMAIL=admin@recce.com
   PGADMIN_PASSWORD=your_secure_password_here
   ```

2. **Use SSH tunnel** (recommended): Access pgAdmin via SSH tunnel instead of exposing port 8080:
   ```bash
   # From your local machine
   ssh -L 8080:localhost:8080 user@your-server-ip
   # Then open: http://localhost:8080
   ```

3. **Firewall rules**: If exposing port 8080, restrict it to specific IPs:
   ```bash
   sudo ufw allow from YOUR_IP to any port 8080
   ```

4. **HTTPS**: Consider setting up nginx reverse proxy with SSL for pgAdmin (similar to main app)

## Troubleshooting

### Database Container Not Running

```bash
# Check container status
docker ps | grep recce_db_prod

# Check logs
docker logs recce_db_prod

# Start if stopped
docker start recce_db_prod
```

### Connection Refused

```bash
# Verify database is healthy
docker exec recce_db_prod pg_isready -U recce_user -d recce_db

# Check environment variables
docker exec recce_db_prod env | grep POSTGRES
```

### Permission Denied

Make sure you're using the correct username from your `.env` file:
- `DB_USER` (default: `recce_user`)
- `DB_NAME` (default: `recce_db`)

## Quick Reference Script

Save this as `db-access.sh` for quick access:

```bash
#!/bin/bash
# Quick database access script

DB_CONTAINER="recce_db_prod"
DB_USER="${DB_USER:-recce_user}"
DB_NAME="${DB_NAME:-recce_db}"

case "$1" in
  connect)
    docker exec -it $DB_CONTAINER psql -U $DB_USER -d $DB_NAME
    ;;
  tables)
    docker exec -it $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -c "\dt"
    ;;
  schema)
    docker exec -it $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -c "\d $2"
    ;;
  query)
    docker exec -it $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -c "$2"
    ;;
  *)
    echo "Usage: $0 {connect|tables|schema|query} [args]"
    echo "  connect          - Open interactive psql session"
    echo "  tables           - List all tables"
    echo "  schema <table>   - Show table schema"
    echo "  query '<sql>'    - Run SQL query"
    exit 1
    ;;
esac
```

Make it executable:
```bash
chmod +x db-access.sh
```

Usage:
```bash
./db-access.sh connect
./db-access.sh tables
./db-access.sh schema recommendations
./db-access.sh query "SELECT COUNT(*) FROM users;"
```

