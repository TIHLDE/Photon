#!/usr/bin/env bash

set -e

DOMAIN="photon.tihlde.org"
IP_ADDRESS=192.168.1.190
PORT=4000
ENV_FILE_PATH=".env"

COMMIT_HASH=$(git rev-parse --short HEAD)
IMAGE_NAME="$DOMAIN:$COMMIT_HASH"

echo "-> Building new Docker image"
docker build --no-cache -f infra/docker/Dockerfile -t $IMAGE_NAME .

echo "-> Stopping and removing old container"
docker rm -f $DOMAIN || true

echo "-> Starting new container"
docker run --env-file $ENV_FILE_PATH -p $IP_ADDRESS:$PORT:4000 --name $DOMAIN --restart unless-stopped -d $IMAGE_NAME
