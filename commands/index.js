const fs = require('fs');
const path = require('path');

// Load all command files
const commandFiles = fs.readdirSync(__dirname).filter(
  (file) => file.endsWith('.js') && file !== 'index.js'
);

const commands = new Map();
const aliases = new Map();

for (const file of commandFiles) {
  const command = require(path.join(__dirname, file));
  commands.set(command.name, command);
  aliases.set(command.name, command.name);
  for (const alias of command.aliases || []) {
    aliases.set(alias, command.name);
  }
}

function getCommandByName(name) {
  const normalized = name.toLowerCase();
  const canonical = aliases.get(normalized);
  return canonical ? commands.get(canonical) : null;
}

function getAllCommands() {
  return Array.from(commands.values());
}

function getCommandHelp(name) {
  const command = getCommandByName(name);
  if (!command) return null;
  return `**${command.name}** — ${command.description}`;
}

module.exports = {
  commands,
  aliases,
  getCommandByName,
  getAllCommands,
  getCommandHelp,
};
