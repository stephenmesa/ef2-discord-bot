const { MessageFlags } = require('discord.js');

module.exports = {
  name: 'ping',
  aliases: [],
  description: 'Responds with Pong!',
  slashOptions: [],
  async execute(interaction) {
    return interaction.reply({ content: 'Pong!', flags: MessageFlags.Ephemeral });
  },
};
