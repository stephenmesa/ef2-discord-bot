module.exports = {
  name: 'stats',
  aliases: [],
  description: 'Admin-only bot usage statistics.',
  adminOnly: true,
  async execute(message, args, context) {
    const { client, db, sendDmWithAttachment } = context;
    const stats = await db.getStats();
    const guildCount = client.guilds.cache.size;
    const channelCount = client.channels.cache.filter((channel) => channel.isTextBased()).size;
    const lines = [
      'EF2 Discord Bot Usage Stats',
      `Total entries: ${stats.totalEntries}`,
      `SR entries: ${stats.totalSr}`,
      `Entries last 24h: ${stats.countLastDay}`,
      `Entries last 7d: ${stats.countLastWeek}`,
      `Connected guilds: ${guildCount}`,
      `Known text channels: ${channelCount}`,
      `Cached users: ${client.users.cache.size}`,
      `Bot prefix: ${context.prefix}`,
    ];

    const buffer = Buffer.from(lines.join('\n'), 'utf8');
    const sent = await sendDmWithAttachment(message.author, 'Your stats are attached.', buffer, 'bot-stats.txt');
    if (sent) {
      return message.reply('Sent usage statistics to your DMs.');
    }
    return message.reply('Unable to send you a DM. Please enable direct messages from this server and try again.');
  },
};
