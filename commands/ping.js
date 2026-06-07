module.exports = {
  name: 'ping',
  aliases: [],
  description: 'Responds with Pong!',
  async execute(message) {
    return message.reply('Pong!');
  },
};
