module.exports = {
  name: 'history',
  aliases: [],
  description: 'Sends your entry history as a CSV file via DM. Usage: history',
  async execute(message, args, context) {
    const { db, buildProgressCsv, sendDmWithAttachment } = context;

    if (args.length > 0) {
      return message.reply('Usage: history');
    }

    const rows = await db.getAllEntries(message.author.id, 'sr', 500);
    if (!rows.length) {
      return message.reply('No SR history found. Use record/sr to add entries.');
    }

    const csvBuffer = buildProgressCsv(rows);
    const sent = await sendDmWithAttachment(
      message.author,
      `Here is your SR history (${rows.length} entries).`,
      csvBuffer,
      `sr-history.csv`
    );

    if (sent) {
      return message.reply('Sent your SR history to your DMs.');
    }
    return message.reply('Unable to send you a DM. Please enable direct messages and try again.');
  },
};
