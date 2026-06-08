#!/bin/bash
# Kill any existing next-server on port 3003
fuser -k 3003/tcp 2>/dev/null
sleep 2
cd /var/www/interconection/frontend
exec node node_modules/next/dist/bin/next start -p 3003
