#!/bin/bash
# Quick database access script for production

DB_CONTAINER="recce_db_prod"
DB_USER="${DB_USER:-appuser}"
DB_NAME="${DB_NAME:-recce_db}"

case "$1" in
  connect)
    docker exec -it $DB_CONTAINER psql -U $DB_USER -d $DB_NAME
    ;;
  tables)
    docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -c "\dt"
    ;;
  schema)
    if [ -z "$2" ]; then
      echo "Usage: $0 schema <table_name>"
      exit 1
    fi
    docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -c "\d $2"
    ;;
  query)
    if [ -z "$2" ]; then
      echo "Usage: $0 query '<sql_query>'"
      exit 1
    fi
    docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -c "$2"
    ;;
  count)
    if [ -z "$2" ]; then
      echo "Usage: $0 count <table_name>"
      exit 1
    fi
    docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -c "SELECT COUNT(*) FROM $2;"
    ;;
  *)
    echo "Database Access Helper"
    echo ""
    echo "Usage: $0 {connect|tables|schema|query|count} [args]"
    echo ""
    echo "Commands:"
    echo "  connect              - Open interactive psql session"
    echo "  tables               - List all tables"
    echo "  schema <table>       - Show table schema/structure"
    echo "  query '<sql>'        - Run SQL query"
    echo "  count <table>        - Count rows in table"
    echo ""
    echo "Examples:"
    echo "  $0 connect"
    echo "  $0 tables"
    echo "  $0 schema recommendations"
    echo "  $0 query \"SELECT COUNT(*) FROM users;\""
    echo "  $0 count recommendations"
    exit 1
    ;;
esac
