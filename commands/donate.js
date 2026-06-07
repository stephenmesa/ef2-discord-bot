module.exports = {
  name: 'donate',
  aliases: ['donation', 'donations'],
  description: 'Shows donation instructions and the configured donation URL.',
  slashOptions: [],
  async execute(interaction, args, context) {
    const { donationUrl } = context;
    return interaction.reply(`Support the bot with donations: ${donationUrl}`);
  },
};
