#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BRIGHT='\033[1m'
NC='\033[0m' # No Color

# Function to print colored output
print_color() {
    echo -e "${2}${1}${NC}"
}

print_color "🧹 Redis Cleanup Script" "$BRIGHT"
print_color "This will delete all Redis keys that do NOT match 'cache-trends:Trends.*'" "$YELLOW"
echo ""

# Ask for confirmation
read -p "Are you sure you want to proceed? (yes/no): " confirm
if [[ $confirm != "yes" ]]; then
    print_color "❌ Operation cancelled" "$RED"
    exit 1
fi

print_color "🔍 Getting Redis keys from trends-run folder..." "$CYAN"

# Get all keys from trends-run folder
trends_run_response=$(curl -s "https://geopol-gtrends.vercel.app/api/redis/list?folder=trends-run&pattern=*")

if [ $? -ne 0 ]; then
    print_color "❌ Failed to connect to Redis API" "$RED"
    exit 1
fi

# Extract keys from the response
trends_run_keys=$(echo "$trends_run_response" | grep -o '"key":"[^"]*"' | sed 's/"key":"//g' | sed 's/"//g')

if [[ -z "$trends_run_keys" ]]; then
    print_color "✅ No trends-run keys found to delete" "$GREEN"
else
    print_color "📊 Found trends-run keys to delete:" "$BLUE"
    echo "$trends_run_keys" | while read -r key; do
        if [[ -n "$key" ]]; then
            print_color "   🗑️  $key" "$RED"
        fi
    done
    
    echo ""
    read -p "Proceed with deletion of trends-run keys? (yes/no): " confirm_delete
    if [[ $confirm_delete != "yes" ]]; then
        print_color "❌ Deletion cancelled" "$RED"
        exit 1
    fi
    
    print_color "🗑️  Deleting trends-run keys..." "$CYAN"
    
    deleted_count=0
    echo "$trends_run_keys" | while read -r key; do
        if [[ -n "$key" ]]; then
            print_color "   Deleting: $key" "$YELLOW"
            delete_response=$(curl -s -X DELETE "https://geopol-gtrends.vercel.app/api/redis/delete" \
                -H "Content-Type: application/json" \
                -d "{\"key\":\"$key\"}")
            
            if echo "$delete_response" | grep -q '"success":true'; then
                print_color "   ✅ Deleted: $key" "$GREEN"
                ((deleted_count++))
            else
                print_color "   ❌ Failed to delete: $key" "$RED"
                print_color "   Response: $delete_response" "$RED"
            fi
        fi
    done
fi

echo ""
print_color "🔍 Checking for other non-cache-trends keys..." "$CYAN"

# Check for other folders that might have keys
folders=("files" "uploads" "temp" "logs")

for folder in "${folders[@]}"; do
    print_color "   Checking folder: $folder" "$BLUE"
    folder_response=$(curl -s "https://geopol-gtrends.vercel.app/api/redis/list?folder=$folder&pattern=*")
    
    if echo "$folder_response" | grep -q '"success":true'; then
        folder_keys=$(echo "$folder_response" | grep -o '"key":"[^"]*"' | sed 's/"key":"//g' | sed 's/"//g')
        
        if [[ -n "$folder_keys" ]]; then
            print_color "   Found keys in $folder:" "$YELLOW"
            echo "$folder_keys" | while read -r key; do
                if [[ -n "$key" ]]; then
                    print_color "     🗑️  $key" "$RED"
                fi
            done
            
            echo ""
            read -p "Delete keys from $folder folder? (yes/no): " confirm_folder
            if [[ $confirm_folder == "yes" ]]; then
                echo "$folder_keys" | while read -r key; do
                    if [[ -n "$key" ]]; then
                        print_color "     Deleting: $key" "$YELLOW"
                        delete_response=$(curl -s -X DELETE "https://geopol-gtrends.vercel.app/api/redis/delete" \
                            -H "Content-Type: application/json" \
                            -d "{\"key\":\"$key\"}")
                        
                        if echo "$delete_response" | grep -q '"success":true'; then
                            print_color "     ✅ Deleted: $key" "$GREEN"
                        else
                            print_color "     ❌ Failed to delete: $key" "$RED"
                        fi
                    fi
                done
            fi
        else
            print_color "   No keys found in $folder" "$GREEN"
        fi
    else
        print_color "   No access to $folder folder" "$YELLOW"
    fi
done

echo ""
print_color "🔍 Verifying remaining cache-trends keys..." "$CYAN"

# Show remaining cache-trends keys
cache_response=$(curl -s "https://geopol-gtrends.vercel.app/api/config/redis-data")

if echo "$cache_response" | grep -q '"success":true'; then
    cache_count=$(echo "$cache_response" | grep -o '"count":[0-9]*' | sed 's/"count"://')
    print_color "✅ Found $cache_count cache-trends keys remaining:" "$GREEN"
    
    echo "$cache_response" | grep -o '"key":"[^"]*"' | sed 's/"key":"//g' | sed 's/"//g' | while read -r key; do
        if [[ -n "$key" ]]; then
            print_color "   📌 $key" "$BLUE"
        fi
    done
else
    print_color "❌ Failed to get cache-trends keys" "$RED"
fi

echo ""
print_color "🎉 Cleanup completed!" "$BRIGHT"
