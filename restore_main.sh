#!/bin/bash
set -e
cd /home/iaemeath/code/todo
HOST_IP=$(grep nameserver /etc/resolv.conf | awk '{print $2}')
export HTTP_PROXY="http://$HOST_IP:7892"
export HTTPS_PROXY="http://$HOST_IP:7892"
npm config set proxy http://$HOST_IP:7892
npm config set https-proxy http://$HOST_IP:7892
git checkout main
npm install
npm config delete proxy
npm config delete https-proxy
echo "Restored node_modules for main!"
