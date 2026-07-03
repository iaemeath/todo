#!/bin/bash
set -e
cd /home/iaemeath/code/todo

echo "Building real V2..."
git checkout 8ce16a2
npm run build
rm -rf public/museum/v2
mkdir -p public/museum/v2
cp -r dist/* public/museum/v2/

echo "Building real V1..."
git checkout d1687d5
npm install konva --no-save --registry=https://registry.npmmirror.com/
npm run build
rm -rf public/museum/v1
mkdir -p public/museum/v1
cp -r dist/* public/museum/v1/

echo "Restoring Main..."
git checkout main
echo "Done!"
