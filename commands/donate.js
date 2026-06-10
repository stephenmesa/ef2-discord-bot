const { MessageFlags } = require('discord.js');

module.exports = {
  name: 'donate',
  aliases: ['donation', 'donations'],
  description: 'Learn how to donate to help support the bot.',
  slashOptions: [],
  async execute(interaction, args, context) {
    const { donationUrl } = context;
    return interaction.reply({ content: `Support the bot with donations: ${donationUrl}`, flags: MessageFlags.Ephemeral });
  },
};
