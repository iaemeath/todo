#!/bin/bash
set -e

cd /home/iaemeath/code/todo
rm -rf showcase_build
mkdir -p showcase_build

echo "Building V3..."
npm run build
mkdir -p showcase_build/v3
cp -r dist/* showcase_build/v3/

echo "Building V2..."
git checkout 8ce16a2
npm install --no-audit --no-fund
npm run build
mkdir -p showcase_build/v2
cp -r dist/* showcase_build/v2/

echo "Building V1..."
git checkout d1687d5
npm install --no-audit --no-fund
npm run build
mkdir -p showcase_build/v1
cp -r dist/* showcase_build/v1/

echo "Restoring Main..."
git checkout main
npm install --no-audit --no-fund

echo "All builds completed successfully!"
