# AGENTS — AI coding agent instructions

Purpose: Provide minimal, actionable guidance for AI coding agents working on this repository.

## Repository Facts
- **Repository Type**: Node.js (CommonJS), Discord Bot using `discord.js` v14.
- **Entry Point**: [index.js](file:///Users/stephenmesa/Code/ef2-discord-bot/index.js)
- **Database**: PostgreSQL via `pg` Pool (connected/initialized in [db.js](file:///Users/stephenmesa/Code/ef2-discord-bot/db.js)).
- **Testing**: Jest unit tests run via `npm test`.
- **Hosting / Budget**: Side project designed to be free/low-cost to run using GCP and Supabase free tiers.

## Architectural Conventions

### 1. Command Routing & Options
- Commands are defined in the [commands/](file:///Users/stephenmesa/Code/ef2-discord-bot/commands/) directory and loaded dynamically by [commands/index.js](file:///Users/stephenmesa/Code/ef2-discord-bot/commands/index.js).
- Slash commands are built using `SlashCommandBuilder` automatically on bot startup based on the `slashOptions` array inside each command module.
- **Command Execute Arguments**:
  ```javascript
  async execute(interaction, args, context)
  ```
- **IMPORTANT**: The dispatcher in `index.js` maps arguments sequentially using `interaction.options.data.map(opt => opt.value)`. This can lead to indexing issues if optional slash command arguments are omitted. Always retrieve optional/named arguments directly from the interaction object:
  ```javascript
  const mpmType = interaction.options.getString('type') || 'standard';
  ```
- For commands that perform asynchronous operations or API calls (like chart generation), call `await interaction.deferReply({ flags: MessageFlags.Ephemeral });` early to prevent Discord from timing out the interaction.

### 2. Database Layer
- Table `progress` stores Knight Level (integer), total medals (text, compact format), SR MPM (text, compact format), and calculated percentages.
- Database functions must return hydrated model objects using `hydrateProgress` to ensure consistent property mappings (e.g. converting database snake_case fields to JS camelCase).
- Add all new DB operations directly to [db.js](file:///Users/stephenmesa/Code/ef2-discord-bot/db.js) and export them.

### 3. Chart Generation (QuickChart)
- Renders charts (line, scatter) using the `quickchart-js` library.
- Keep chart generation logic inside [utils.js](file:///Users/stephenmesa/Code/ef2-discord-bot/utils.js) and expose through `context`.
- **Outlier Filtering**: Users can enter typos or joke values (e.g., Knight Level 5000+). When plotting global database metrics, filter out extreme values (e.g., `knight_level <= 1000`) to prevent chart scaling issues.
- **Logarithmic Scales**: Medals and MPM metrics grow exponentially in Endless Frontier 2. A logarithmic Y-axis scale is required when plotting metrics across wide Knight Level ranges to prevent lower-level data from being compressed to zero.

### 4. Endless Frontier 2 Compact Numbers
- EF2 uses compact notation for numbers (e.g., `a` = 10^3, `b` = 10^6, `c` = 10^9, ..., `z` = 10^78, `aa` = 10^81).
- Formula: 10^(3N) where N is the Excel-like index of the letter(s).
- **Coefficient Rule**: Representing a number in compact form MUST have exactly three digits with an optional decimal (e.g. `4.56`, `45.6`, `456` are correct; `4.567`, `45.67` are invalid).
- Use [utils.js](file:///Users/stephenmesa/Code/ef2-discord-bot/utils.js) helpers:
  - `parseCompactNumber(value)`: String to Number.
  - `compactifyNumber(value)`: Number to String.

### 5. Testing & Mocks
- Write test files alongside code as `<module>.test.js`.
- If testing database methods, mock the `pg` Pool:
  ```javascript
  jest.mock('pg', () => {
    const mPool = { connect: jest.fn(), query: jest.fn(), on: jest.fn() };
    return { Pool: jest.fn(() => mPool) };
  });
  ```
- If testing chart helpers, mock `quickchart-js` to prevent live HTTP requests during test runs.

## General Guidelines
- **Link, don't embed**: prefer referencing files/lines with clickable Markdown links rather than copying blocks of code.
- **Minimal edits**: make focused modifications and avoid changing unrelated files.
- Consult the operator (user) rather than guessing when requirements are unclear.
