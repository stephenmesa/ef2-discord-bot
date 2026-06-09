docker buildx build --platform linux/amd64,linux/arm64 \
  -t us-west1-docker.pkg.dev/ef2-discord-bot/ef2-discord-bot/ef2-discord-bot:latest \
  --push ..