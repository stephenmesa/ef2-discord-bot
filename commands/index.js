const fs = require('fs');
const path = require('path');
const { SlashCommandBuilder } = require('discord.js');

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

function buildSlashCommands() {
  const slashCommands = [];
  
  for (const command of commands.values()) {
    const builder = new SlashCommandBuilder()
      .setName(command.name)
      .setDescription(command.description);
    
    // Add options if defined
    if (command.slashOptions && Array.isArray(command.slashOptions)) {
      for (const option of command.slashOptions) {
        const { name, description, type, required = false, choices } = option;
        
        if (type === 3) { // STRING
          if (choices) {
            builder.addStringOption(opt => 
              opt.setName(name).setDescription(description).setRequired(required)
                .addChoices(...choices)
            );
          } else {
            builder.addStringOption(opt => 
              opt.setName(name).setDescription(description).setRequired(required)
            );
          }
        } else if (type === 4) { // INTEGER
          if (choices) {
            builder.addIntegerOption(opt =>
              opt.setName(name).setDescription(description).setRequired(required)
                .addChoices(...choices)
            );
          } else {
            builder.addIntegerOption(opt =>
              opt.setName(name).setDescription(description).setRequired(required)
            );
          }
        } else if (type === 5) { // BOOLEAN
          builder.addBooleanOption(opt =>
            opt.setName(name).setDescription(description).setRequired(required)
          );
        } else if (type === 6) { // USER
          builder.addUserOption(opt =>
            opt.setName(name).setDescription(description).setRequired(required)
          );
        } else if (type === 7) { // CHANNEL
          builder.addChannelOption(opt =>
            opt.setName(name).setDescription(description).setRequired(required)
          );
        } else if (type === 8) { // ROLE
          builder.addRoleOption(opt =>
            opt.setName(name).setDescription(description).setRequired(required)
          );
        }
      }
    }
    
    slashCommands.push(builder.toJSON());
  }
  
  return slashCommands;
}

module.exports = {
  commands,
  aliases,
  getCommandByName,
  getAllCommands,
  getCommandHelp,
  buildSlashCommands,
};
