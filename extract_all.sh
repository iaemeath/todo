#!/bin/bash
set -e
cd /home/iaemeath/code/todo

echo "Building real V2..."
git checkout 8ce16a2 -f
npx vite build --base=./
rm -rf public/museum/v2
mkdir -p public/museum/v2
cp -r dist/* public/museum/v2/

echo "Building real V1..."
git checkout d1687d5 -f
sed -i 's/import { useTodos, Task }/import { useTodos, type Task }/g' src/components/TaskManagerList.vue || true
sed -i 's/import { useTodos, Todo }/import { useTodos, type Todo }/g' src/components/TodoManagerList.vue || true
npm install konva --no-save --registry=https://registry.npmmirror.com/
npx vite build --base=./
rm -rf public/museum/v1
mkdir -p public/museum/v1
cp -r dist/* public/museum/v1/

echo "Restoring Main..."
git checkout main -f
npm install --no-audit --no-fund --registry=https://registry.npmmirror.com/
echo "Done!"
