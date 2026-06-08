const { MessageFlags } = require('discord.js');

module.exports = {
  name: 'help',
  aliases: ['commands'],
  description: 'Lists available commands or shows details for one command.',
  slashOptions: [
    {
      name: 'command',
      description: 'The name of a specific command to get help for',
      type: 3, // STRING
      required: false,
    },
  ],
  async execute(interaction, args, context) {
    const { getCommandHelp, getAllCommands } = context;

    const commandName = args[0];
    
    if (!commandName) {
      const commands = getAllCommands();
      const lines = ['EF2 Discord Bot commands:'];
      for (const cmd of commands) {
        lines.push(`- ${cmd.name} — ${cmd.description}`);
      }
      return interaction.reply({ content: lines.join('\n'), flags: MessageFlags.Ephemeral });
    }

    const help = getCommandHelp(commandName.toLowerCase());
    if (!help) {
      return interaction.reply({ content: `No help available for command: ${commandName}`, flags: MessageFlags.Ephemeral });
    }
    return interaction.reply({ content: help, flags: MessageFlags.Ephemeral });
  },
};
