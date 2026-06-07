module.exports = {
  name: 'ping',
  aliases: [],
  description: 'Responds with Pong!',
  slashOptions: [],
  async execute(interaction) {
    return interaction.reply('Pong!');
  },
};
