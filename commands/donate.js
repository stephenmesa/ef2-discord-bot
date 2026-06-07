module.exports = {
  name: 'donate',
  aliases: ['donation', 'donations'],
  description: 'Shows donation instructions and the configured donation URL.',
  async execute(message, args, context) {
    const { donationUrl } = context;
    return message.reply(`Support the bot with donations: ${donationUrl}`);
  },
};
