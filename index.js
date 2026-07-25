require('dotenv').config();
const { Client, GatewayIntentBits, Partials, AttachmentBuilder, REST, Routes, MessageFlags, ActivityType } = require('discord.js');
const db = require('./db');
const utils = require('./utils');
const commandLoader = require('./commands');
const { createMaintenanceMonitor, parseChannelIds, parseCheckIntervalSeconds } = require('./maintenanceMonitor');

const token = process.env.DISCORD_TOKEN;
const donationUrl = process.env.DONATION_URL || 'https://example.com/donate';
const botStatus = process.env.BOT_STATUS || 'tracking EF2 SR progress';
const cooldownSeconds = Number(process.env.COOLDOWN_SECONDS || 3);
const maintenanceChannelIds = parseChannelIds(process.env.MAINTENANCE_CHANNEL_IDS);
const maintenanceCheckIntervalSeconds = parseCheckIntervalSeconds(process.env.MAINTENANCE_CHECK_INTERVAL_SECONDS);
const adminUserIds = new Set(
  (process.env.ADMIN_USERIDS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
);

const versionString = process.env.BOT_VERSION || '1.0.0';

if (!token) {
  console.error('Missing DISCORD_TOKEN. Set this environment variable before starting.');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('Missing DATABASE_URL. Set this environment variable before starting.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

const cooldowns = new Map();

function isAdmin(userId) {
  return adminUserIds.has(userId);
}

function checkCooldown(userId, commandName) {
  const key = `${userId}:${commandName}`;
  const last = cooldowns.get(key) || 0;
  const now = Date.now();
  if (now - last < cooldownSeconds * 1000) {
    return Math.ceil((cooldownSeconds * 1000 - (now - last)) / 1000);
  }
  cooldowns.set(key, now);
  return 0;
}

async function sendDmWithAttachment(user, content, buffer, fileName) {
  try {
    await user.send({ content, files: [new AttachmentBuilder(buffer, { name: fileName })] });
    return true;
  } catch (error) {
    return false;
  }
}

// Build the context object that all commands receive
function buildContext() {
  return {
    client,
    db,
    donationUrl,
    // Utility functions
    ...utils,
    // Command utilities
    getCommandHelp: commandLoader.getCommandHelp,
    getAllCommands: commandLoader.getAllCommands,
    // Discord utilities
    sendDmWithAttachment,
  };
}

// Register slash commands
async function registerSlashCommands() {
  try {
    const commands = commandLoader.buildSlashCommands();
    const rest = new REST({ version: '10' }).setToken(token);

    console.log(`Registering ${commands.length} slash commands...`);
    
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    
    console.log(`Successfully registered ${commands.length} slash commands.`);
  } catch (error) {
    console.error('Failed to register slash commands:', error);
  }
}

client.on('clientReady', async () => {
  try {
    await db.initDatabase();
    console.log(`Logged in as ${client.user.tag}`);
    console.log(`Connected to ${client.guilds.cache.size} guild(s): ${client.guilds.cache.map((guild) => guild.name).join(', ') || 'none'}`);
    client.user.setActivity(botStatus, { type: 'WATCHING' });
    client.user.setPresence({
      activities: [{
        name: 'custom',
        type: ActivityType.Custom,
        state: `v${versionString}`,
      }],
      status: 'online'
    })
    await registerSlashCommands();

    if (maintenanceChannelIds.length) {
      const maintenanceMonitor = createMaintenanceMonitor({
        client,
        channelIds: maintenanceChannelIds,
        intervalSeconds: maintenanceCheckIntervalSeconds,
      });

      await maintenanceMonitor.checkNow();
      maintenanceMonitor.start();
      console.log(`Maintenance monitoring enabled for ${maintenanceChannelIds.length} channel(s) every ${maintenanceCheckIntervalSeconds} second(s).`);
    } else {
      console.log('Maintenance monitoring disabled because no MAINTENANCE_CHANNEL_IDS were provided.');
    }
  } catch (error) {
    console.error('Failed to initialize database:', error.message);
    console.error('Please check your DATABASE_URL environment variable and ensure the database is accessible.');
    process.exit(1);
  }
});

client.on('error', (error) => {
  console.error('Discord client error:', error);
});

client.on('warn', (warning) => {
  console.warn('Discord client warning:', warning);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commandLoader.getCommandByName(interaction.commandName);
  if (!command) return;

  const cooldownRemaining = checkCooldown(interaction.user.id, command.name);
  if (cooldownRemaining > 0) {
    return interaction.reply({
      content: `Please wait ${cooldownRemaining}s before using that command again.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  if (command.adminOnly && !isAdmin(interaction.user.id)) {
    return interaction.reply({
      content: 'You do not have permission to use that command.',
      flags: MessageFlags.Ephemeral,
    });
  }

  try {
    const context = buildContext();
    // Collect options into an args-like array
    const options = interaction.options.data.map(opt => opt.value);
    await command.execute(interaction, options, context);
  } catch (error) {
    console.error(`Command ${command.name} execution failed:`, error);
    const response = {
      content: 'Something went wrong while running that command. Please try again later.',
      flags: MessageFlags.Ephemeral,
    };
    if (interaction.replied || interaction.deferred) {
      try {
        return interaction.editReply(response);
      } catch (replyError) {
        console.error('Failed to edit failed interaction reply:', replyError);
        return;
      }
    }
    return interaction.reply(response);
  }
});

client.login(token).catch((error) => {
  console.error('Discord login failed:', error);
  process.exit(1);
});
