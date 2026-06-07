# Endless Frontier 2 Discord Bot Requirements

## 1. Overview

This document defines the requirements for the Endless Frontier 2 Discord Bot, a Discord bot designed to help Endless Frontier 2 players record and analyze their game progress.

The bot is command-driven via a configurable prefix and stores progress data in a backing persistence store.

## 2. Goals

- Allow players to record Soul Rest (SR) progress directly from Discord.
- Provide useful analysis and feedback on recorded progress.
- Store user progress history and enable retrieval, export, and deletion of entries.
- Generate visual progress charts for players.
- Provide general bot utility commands including help and ping.
- Support administrative reporting of bot usage statistics.

## 3. Users and Roles

- Regular Users
  - Record SR progress.
  - View grades, history, and charts.
  - Manage their own recorded entries.

- Admin Users
  - Same capabilities as regular users, plus access to bot usage statistics.

## 4. Environment and Configuration

The bot must run in a Node.js environment and depends on the following environment variables:

- `DISCORD_TOKEN` - Discord bot API token.
- `BOT_PREFIX` - Command prefix used by the bot (commonly `!`).
- `ADMIN_USERIDS` - Comma-separated Discord user IDs for admin command access.
- `DONATION_URL` - URL displayed by the donation command.
- `BOT_STATUS` - Optional bot status text on startup.

## 5. Command Interface

### 5.1 General Utility Commands

- `ping`
  - Responds with `Pong!`.

- `help [command name]`
  - Lists available commands.
  - Shows details and usage for a specific command.
  - Supports alias `commands`.

- `stats`
  - Admin-only command.
  - Returns bot usage statistics, including record counts over the last day and week, joined guilds, and channels.
  - Sends results as a text file attachment via private message.

- `donate`
  - Displays donation instructions and the configured donation URL.
  - Aliases: `donation`, `donations`.

### 5.2 Soul Rest / Progress Recording Commands

- `record <knight level> <total medals> <SR mpm>`
  - Primary progress recording command.
  - Alias: `sr`.
  - Calculates estimated SR percentage and doubled SR percentage.
  - Validates inputs and rejects invalid values.
  - Stores progress in persistence.
  - If previous progress exists, generates a progress summary showing KL gain and medal percentage gain.
  - Compares current progress to recent progress in a nearby knight level (KL) range to compute an SR grade.

- `grade`
  - Shows the user's current SR grade based on recently recorded progress.
  - Compares the latest entry against stored entries in nearby knight levels.
  - Displays KL group ranges and grade percentile.

### 5.3 Progress History and Management Commands

- `history`
  - Returns the user’s recorded history for SR entries.
  - Sends a CSV file attachment of entries in a private message.
  - If no history exists, informs the user and suggests how to record entries.

- `undo`
  - Deletes the user’s most recent SR entry.
  - Returns confirmation including the deleted entry details and age.
  - If no matching entry exists, returns an error message.

- `delete <ID>`
  - Deletes a specific SR entry by ID for the user.
  - Returns confirmation including deleted entry details and age.
  - Handles invalid IDs or missing records gracefully.

## 7. Graphing and Visualization

- `graph [kl|medals]`
  - Generates a visual chart of recent SR progress.
  - If called with no argument, generates a combined KL and medals chart.
  - `graph kl` generates a KL progression line chart.
  - `graph medals` generates a medals progression line chart with log scaling.
  - Sends chart as an attached image file.

- Chart generation sends a PNG file.
- Generated files are cleaned up after sending in Discord.

## 8. Data Validation and Parsing

- Supports parsing compact medal and rate notation using letter suffixes:
  - Example: `1a`, `2b`, etc.
  - Converts shorthand to numeric values before analysis.
- Validates that percentage calculations are within reasonable bounds (greater than 0 and below 100).

## 9. Persistence and Storage

- Stores SR progress in a `Progress` entity.
- User is identified by Discord user ID.
- Supports retrieving:
  - latest user progress,
  - all user entries up to a configurable limit,
  - progress entries filtered by nearby knight level range.
- Supports deleting latest and specific records safely.

## 10. Bot Behavior and Constraints

- Message handling is prefix-based and ignores messages from bots.
- Command names are case-insensitive.
- Supports aliases for convenience.
- Rate-limits each command per user with a default cooldown of 3 seconds.
- Provides structured error replies for invalid arguments, permissions, and missing data.
- Handles Discord permission errors gracefully and logs failures.

## 11. Nonfunctional Requirements

- The bot must be containerized and deployable via Docker.
- It must be able to run in any environment where Node.js and the configured dependencies are available.
- Data persistence must use a managed postgres database (most likely hosted on Supabase).
- The bot should provide clear, user-friendly feedback for all command interactions.
- The bot should be easily expandable to support more commands in the future.

## 12. Optional / Extended Behavior

- Admin users can use `stats` to monitor bot adoption and active recording behavior.
- The bot may show additional helpful text and tips after recording progress.

## 13. Implementation Notes

- The bot is implemented using the latest libraries recommended by Discord for node clients and JavaScript modules.
- Commands are organized into groups: general, graph, record.
- Utility modules handle data parsing, grade and percentage calculations, and chart creation.
- The bot includes error handling around database operations, command execution, and Discord API failures.
