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
      return interaction.reply(lines.join('\n'));
    }

    const help = getCommandHelp(commandName.toLowerCase());
    if (!help) {
      return interaction.reply(`No help available for command: ${commandName}`);
    }
    return interaction.reply(help);
  },
};
