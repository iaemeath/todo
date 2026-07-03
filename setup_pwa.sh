#!/bin/bash
set -e
cd /home/iaemeath/code/todo
npm install vite-plugin-pwa -D --registry=https://registry.npmmirror.com
mkdir -p public
HOST_IP=$(grep nameserver /etc/resolv.conf | awk '{print $2}')
curl -x http://$HOST_IP:7892 -o public/pwa-192x192.png 'https://ui-avatars.com/api/?name=AI+Todo&size=192&background=random'
curl -x http://$HOST_IP:7892 -o public/pwa-512x512.png 'https://ui-avatars.com/api/?name=AI+Todo&size=512&background=random'
