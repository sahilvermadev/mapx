# pgAdmin Database Viewer Guide

This guide explains how to view and explore your Recce database using pgAdmin.

## 🚀 Quick Start

### 1. Access pgAdmin
- Open your browser and go to: **http://localhost:8080**
- Login with:
  - **Email:** `admin@recce.com`
  - **Password:** `admin123`

### 2. Connect to Database
- Right-click "Servers" in the left panel
- Select "Register" → "Server..."
- Fill in the connection details:

**General Tab:**
- **Name:** `Recce Database`

**Connection Tab:**
- **Host name/address:** `db`
- **Port:** `5432`
- **Maintenance database:** `recce_db`
- **Username:** `appuser`
- **Password:** `janakpuri`
- **Save password:** ✅ (check this box)

- Click "Save"

## 📊 Viewing Database Schema

### Navigate to Tables
1. In the left panel, expand: `recce_database` → `Schemas` → `public` → `Tables`
2. You'll see all your database tables:
   - `users` - User accounts and profiles
   - `questions` - Q&A posts
   - `recommendations` - Place/service recommendations
   - `places` - Location data
   - `services` - Service provider information
   - `notifications` - User notifications
   - `friend_groups` - User groups
   - And many more!

## 🔍 Viewing Table Data

### Method 1: Data Tab
1. Click on any table name (e.g., `users`)
2. Click the **"Data"** tab in the main panel
3. View all rows of data in that table

### Method 2: Right-Click Menu
1. Right-click on any table name
2. Select **"View/Edit Data"** → **"All Rows"**

### Method 3: SQL Queries
1. Click the **"SQL"** tab in the main panel
2. Write custom queries like:
   ```sql
   -- View all users
   SELECT * FROM users LIMIT 10;
   
   -- View recent questions
   SELECT * FROM questions ORDER BY created_at DESC LIMIT 5;
   
   -- Count records in each table
   SELECT 'users' as table_name, COUNT(*) as row_count FROM users
   UNION ALL
   SELECT 'questions', COUNT(*) FROM questions
   UNION ALL
   SELECT 'recommendations', COUNT(*) FROM recommendations;
   ```

## 🛠️ Useful Features

### Table Structure
- Click on any table to see:
  - **Columns** - Field names and data types
  - **Constraints** - Primary keys, foreign keys
  - **Indexes** - Performance indexes
  - **Triggers** - Database triggers

### Data Management
- **Filtering:** Add filters to search specific data
- **Sorting:** Click column headers to sort
- **Pagination:** Navigate through large datasets
- **Editing:** Modify data directly (be careful!)

### Performance Monitoring
- View the **Dashboard** tab for:
  - Server sessions
  - Transaction rates
  - Database performance metrics

## 🔧 Troubleshooting

### CSRF Error
If you see "CSRF session token is missing":
1. Refresh the page (Ctrl+Shift+R)
2. Log out and log back in
3. Clear browser data for localhost:8080

### Connection Issues
If you can't connect to the database:
1. Check that Docker containers are running: `docker-compose ps`
2. Restart services: `docker-compose restart`
3. Verify database credentials in `.env` file

## 📝 Quick Reference

| Action | Steps |
|--------|-------|
| View all tables | `recce_database` → `Schemas` → `public` → `Tables` |
| See table data | Click table → `Data` tab |
| Run SQL query | Click `SQL` tab → write query → execute |
| Edit data | Right-click table → `View/Edit Data` |
| View table structure | Click table → `Columns` tab |

## 🎯 Common Queries

```sql
-- Check if database has data
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM questions;
SELECT COUNT(*) FROM recommendations;

-- View recent activity
SELECT * FROM questions ORDER BY created_at DESC LIMIT 10;
SELECT * FROM recommendations ORDER BY created_at DESC LIMIT 10;

-- Check user registrations
SELECT display_name, email, created_at FROM users ORDER BY created_at DESC;
```

---

**Note:** This is a development database. Be careful when editing data directly as changes are permanent!




















