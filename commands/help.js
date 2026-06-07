module.exports = {
  name: 'help',
  aliases: ['commands'],
  description: 'Lists available commands or shows details for one command.',
  async execute(message, args, context) {
    const { getCommandHelp, getAllCommands } = context;

    if (args.length === 0) {
      const commands = getAllCommands();
      const lines = ['EF2 Discord Bot commands:'];
      for (const cmd of commands) {
        lines.push(`- ${cmd.name} — ${cmd.description}`);
      }
      return message.reply(lines.join('\n'));
    }

    const commandName = args[0].toLowerCase();
    const help = getCommandHelp(commandName);
    if (!help) {
      return message.reply(`No help available for command: ${commandName}`);
    }
    return message.reply(help);
  },
};
