#!/bin/bash

# Script to replace alexon-photo.jpg
# Usage: ./replace-photo.sh /path/to/your/photo.jpg

if [ -z "$1" ]; then
    echo "Usage: ./replace-photo.sh /path/to/your/photo.jpg"
    echo ""
    echo "Or drag and drop your photo file into the terminal after typing:"
    echo "./replace-photo.sh "
    exit 1
fi

SOURCE_FILE="$1"
TARGET_FILE="public/alexon-photo.jpg"

if [ ! -f "$SOURCE_FILE" ]; then
    echo "Error: Source file not found: $SOURCE_FILE"
    exit 1
fi

# Copy the file
cp "$SOURCE_FILE" "$TARGET_FILE"
echo "✅ Photo replaced successfully!"
echo "   Source: $SOURCE_FILE"
echo "   Target: $TARGET_FILE"
echo ""
echo "Next steps:"
echo "1. Run: npm run build"
echo "2. Run: vercel --prod --yes"







