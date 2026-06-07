require('dotenv').config();
const { Client, GatewayIntentBits, Partials, AttachmentBuilder } = require('discord.js');
const db = require('./db');
const utils = require('./utils');
const commandLoader = require('./commands');

const token = process.env.DISCORD_TOKEN;
const prefix = process.env.BOT_PREFIX || '!';
const donationUrl = process.env.DONATION_URL || 'https://example.com/donate';
const botStatus = process.env.BOT_STATUS || 'tracking EF2 SR progress';
const cooldownSeconds = Number(process.env.COOLDOWN_SECONDS || 3);
const adminUserIds = new Set(
  (process.env.ADMIN_USERIDS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
);

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
    prefix,
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

client.on('clientReady', async () => {
  try {
    await db.initDatabase();
    console.log(`Logged in as ${client.user.tag}`);
    console.log(`Connected to ${client.guilds.cache.size} guild(s): ${client.guilds.cache.map((guild) => guild.name).join(', ') || 'none'}`);
    client.user.setActivity(botStatus, { type: 'WATCHING' });
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

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(prefix)) return;

  const content = message.content.slice(prefix.length).trim();
  if (!content.length) return;

  const [rawCommand, ...args] = content.split(/\s+/);
  const command = commandLoader.getCommandByName(rawCommand);
  if (!command) return;

  const cooldownRemaining = checkCooldown(message.author.id, command.name);
  if (cooldownRemaining > 0) {
    return message.reply(`Please wait ${cooldownRemaining}s before using that command again.`);
  }

  if (command.adminOnly && !isAdmin(message.author.id)) {
    return message.reply('You do not have permission to use that command.');
  }

  try {
    const context = buildContext();
    await command.execute(message, args, context);
  } catch (error) {
    console.error(`Command ${command.name} execution failed:`, error);
    return message.reply('Something went wrong while running that command. Please try again later.');
  }
});

client.login(token).catch((error) => {
  console.error('Discord login failed:', error);
  process.exit(1);
});
