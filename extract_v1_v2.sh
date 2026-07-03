#!/bin/bash
set -e
cd /home/iaemeath/code/todo

echo "Building V2..."
git checkout 8ce16a2
rm -rf node_modules package-lock.json
npm install --no-audit --no-fund --registry=https://registry.npmmirror.com/
npm run build
mkdir -p showcase_build/v2
cp -r dist/* showcase_build/v2/

echo "Building V1..."
git checkout d1687d5
rm -rf node_modules package-lock.json
npm install --no-audit --no-fund --registry=https://registry.npmmirror.com/
npm run build
mkdir -p showcase_build/v1
cp -r dist/* showcase_build/v1/

echo "Restoring Main..."
git checkout main
rm -rf node_modules package-lock.json
npm install --no-audit --no-fund --registry=https://registry.npmmirror.com/

echo "Done!"
