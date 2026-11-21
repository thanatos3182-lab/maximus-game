#!/bin/sh
set -e
cd "$(dirname "$0")/.."
rm -rf android/app/src/main/assets/www
mkdir -p android/app/src/main/assets/www
cp game/index.html android/app/src/main/assets/www/
cp -r game/js android/app/src/main/assets/www/js
echo "game synced into android/app/src/main/assets/www"
