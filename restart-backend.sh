#!/bin/bash
# Restart the backend container and reload nginx so it picks up the new upstream IP.
set -e

echo "Restarting backend-dev..."
docker restart backend-dev

echo "Waiting for backend to be healthy..."
until docker exec backend-dev curl -sf http://localhost:8000/api/ > /dev/null 2>&1; do
  sleep 1
done

echo "Reloading nginx..."
docker exec nginx-dev nginx -s reload

echo "Done. Backend is up and nginx has reloaded."
