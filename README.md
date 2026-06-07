# ef2-discord-bot
A Discord bot for assisting players of Endless Frontier 2 with Soul Rest progress tracking.

## Features

- Record SR progress via Discord commands.
- Compute estimated SR percentage and doubled SR percentage.
- Compare your current progress to nearby knight level entries.
- View recent progress history and delete entries safely.
- Generate visual progress charts as PNG attachments.
- Admin-only statistics via DM.

## Environment Variables

Required:
- `DISCORD_TOKEN` - Discord bot token.
- `DATABASE_URL` - PostgreSQL connection string.
- `BOT_PREFIX` - Command prefix, for example `!`.
- `ADMIN_USERIDS` - Comma-separated Discord user IDs for admin access.
- `DONATION_URL` - Donation link shown by the `donate` command.

Optional:
- `BOT_STATUS` - Status text displayed on bot startup.
- `COOLDOWN_SECONDS` - Rate limit per user per command (default `3`).
- `DB_SSL` - Set to `true` to enable TLS for the database connection.

## Commands

- `ping` — Responds with `Pong!`
- `help [command]` — Lists commands or shows command usage.
- `stats` — Admin-only bot usage stats sent via DM.
- `donate` — Displays donation instructions.
- `record <knight level> <total medals> <SR mpm>` — Record SR progress. Alias: `sr`.
- `grade` — Show current SR grade based on nearby entries.
- `history <sr|raid>` — Send your entry history as a CSV file via DM.
- `undo <sr|raid>` — Delete your most recent entry.
- `delete <sr|raid> <ID>` — Delete a specific entry by ID.
- `graph [kl|medals]` — Generate a progress chart PNG.

## Setup

Install dependencies:

```bash
npm install
```

Run the bot:

```bash
npm start
```

## Docker

Build the image:

```bash
docker build -t ef2-discord-bot .
```

Run with environment variables:

```bash
docker run -e DISCORD_TOKEN="your_token" \
  -e DATABASE_URL="your_database_url" \
  -e BOT_PREFIX="!" \
  -e ADMIN_USERIDS="1234567890" \
  -e DONATION_URL="https://example.com/donate" \
  ef2-discord-bot
```
