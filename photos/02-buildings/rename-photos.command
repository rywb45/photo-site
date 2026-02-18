#!/bin/bash

# ============================================
# RENAME PHOTOS - Double-click to run!
# Renames all photos in this folder to
# 001.jpg, 002.jpg, etc. based on filename order
# ============================================

cd "$(dirname "$0")"

# Temp rename first to avoid conflicts (e.g. 002.jpg already exists)
count=1
for file in $(ls -1 *.jpg *.jpeg *.JPG *.JPEG 2>/dev/null | sort); do
    # Skip this script itself
    [[ "$file" == *.command ]] && continue
    mv "$file" "temp_${count}.jpg"
    ((count++))
done

# Now rename to final names
count=1
for file in $(ls -1 temp_*.jpg 2>/dev/null | sort -t_ -k2 -n); do
    printf -v newname "%03d.jpg" "$count"
    mv "$file" "$newname"
    ((count++))
done

echo "✅ Renamed $((count-1)) photos!"
echo ""
read -p "Press Enter to close..."
