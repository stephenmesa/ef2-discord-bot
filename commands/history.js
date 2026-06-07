module.exports = {
  name: 'history',
  aliases: [],
  description: 'Sends your entry history as a CSV file via DM. Usage: history <sr|raid>',
  async execute(message, args, context) {
    const { db, parseEntryType, buildProgressCsv, sendDmWithAttachment } = context;

    const type = parseEntryType(args[0]);
    if (!type) {
      return message.reply('Usage: history <sr|raid>');
    }

    const rows = await db.getAllEntries(message.author.id, type, 500);
    if (!rows.length) {
      return message.reply(`No ${type.toUpperCase()} history found. Use record/sr to add entries.`);
    }

    const csvBuffer = buildProgressCsv(rows);
    const sent = await sendDmWithAttachment(
      message.author,
      `Here is your ${type.toUpperCase()} history (${rows.length} entries).`,
      csvBuffer,
      `${type}-history.csv`
    );

    if (sent) {
      return message.reply(`Sent your ${type.toUpperCase()} history to your DMs.`);
    }
    return message.reply('Unable to send you a DM. Please enable direct messages and try again.');
  },
};
