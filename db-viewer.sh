#!/bin/bash
# Database Viewer - View all tables and their contents in a formatted way

DB_CONTAINER="recce_db_prod"
DB_USER="${DB_USER:-appuser}"
DB_NAME="${DB_NAME:-recce_db}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to get table list
get_tables() {
    docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -t -c "
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        ORDER BY tablename;
    " | tr -d ' ' | grep -v '^$'
}

# Function to get row count for a table
get_row_count() {
    local table=$1
    docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM $table;" | tr -d ' '
}

# Function to show table structure
show_table_structure() {
    local table=$1
    docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -c "\d $table"
}

# Function to show table data (formatted)
show_table_data() {
    local table=$1
    local limit=${2:-10}
    docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -c "SELECT * FROM $table LIMIT $limit;" -x
}

# Function to show all tables summary
show_all_tables() {
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}                    DATABASE TABLES OVERVIEW${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════════════${NC}"
    echo ""
    
    local tables=$(get_tables)
    local total_tables=0
    local total_rows=0
    
    printf "%-30s %15s\n" "TABLE NAME" "ROW COUNT"
    echo "────────────────────────────────────────────────────────────────────────────"
    
    for table in $tables; do
        local count=$(get_row_count $table)
        printf "%-30s %15s\n" "$table" "$count"
        total_tables=$((total_tables + 1))
        total_rows=$((total_rows + count))
    done
    
    echo "────────────────────────────────────────────────────────────────────────────"
    printf "%-30s %15s\n" "TOTAL: $total_tables tables" "$total_rows rows"
    echo ""
}

# Function to show specific table details
show_table_details() {
    local table=$1
    local limit=${2:-10}
    
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}                    TABLE: ${YELLOW}$table${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════════════${NC}"
    echo ""
    
    # Show row count
    local count=$(get_row_count $table)
    echo -e "${GREEN}Total Rows:${NC} $count"
    echo ""
    
    # Show structure
    echo -e "${BLUE}Table Structure:${NC}"
    show_table_structure $table
    echo ""
    
    # Show sample data
    if [ "$count" -gt 0 ]; then
        echo -e "${BLUE}Sample Data (first $limit rows):${NC}"
        show_table_data $table $limit
    else
        echo -e "${YELLOW}No data in this table${NC}"
    fi
    echo ""
}

# Main menu
case "$1" in
  list|overview|all)
    show_all_tables
    ;;
  table|show)
    if [ -z "$2" ]; then
      echo -e "${RED}Error: Table name required${NC}"
      echo "Usage: $0 table <table_name> [limit]"
      exit 1
    fi
    show_table_details "$2" "${3:-10}"
    ;;
  structure|schema)
    if [ -z "$2" ]; then
      echo -e "${RED}Error: Table name required${NC}"
      echo "Usage: $0 structure <table_name>"
      exit 1
    fi
    show_table_structure "$2"
    ;;
  data)
    if [ -z "$2" ]; then
      echo -e "${RED}Error: Table name required${NC}"
      echo "Usage: $0 data <table_name> [limit]"
      exit 1
    fi
    show_table_data "$2" "${3:-10}"
    ;;
  count)
    if [ -z "$2" ]; then
      echo -e "${RED}Error: Table name required${NC}"
      echo "Usage: $0 count <table_name>"
      exit 1
    fi
    echo $(get_row_count "$2")
    ;;
  *)
    echo -e "${CYAN}Database Viewer${NC}"
    echo ""
    echo "Usage: $0 {list|table|structure|data|count} [args]"
    echo ""
    echo "Commands:"
    echo "  list, overview, all              - Show all tables with row counts"
    echo "  table <name> [limit]             - Show full details of a table (structure + data)"
    echo "  structure <name>                 - Show table structure only"
    echo "  data <name> [limit]              - Show table data only (default: 10 rows)"
    echo "  count <name>                     - Show row count for a table"
    echo ""
    echo "Examples:"
    echo "  $0 list                          # List all tables"
    echo "  $0 table services                # Show services table details"
    echo "  $0 table users 20                # Show users table with 20 rows"
    echo "  $0 structure recommendations     # Show recommendations table structure"
    echo "  $0 data services 5              # Show first 5 rows of services"
    echo "  $0 count users                   # Count rows in users table"
    exit 1
    ;;
esac

