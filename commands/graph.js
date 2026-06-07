module.exports = {
  name: 'graph',
  aliases: [],
  description: 'Generates a progress chart PNG. Usage: graph [kl|medals]',
  async execute(message, args, context) {
    const { db, buildChartBuffer } = context;
    const { AttachmentBuilder } = require('discord.js');

    const modeArg = args[0] ? args[0].toLowerCase() : 'combined';
    const mode = ['combined', 'kl', 'medals'].includes(modeArg) ? modeArg : null;
    if (!mode) {
      return message.reply('Usage: graph [kl|medals]');
    }

    const rows = await db.getAllEntries(message.author.id, 'sr', 200);
    if (!rows.length) {
      return message.reply('No SR entries found. Record progress to generate a graph.');
    }

    const buffer = await buildChartBuffer(rows, mode);
    const attachment = new AttachmentBuilder(buffer, { name: `sr-graph-${mode}.png` });
    return message.reply({ content: `Here is your SR ${mode === 'combined' ? 'progress' : mode} chart.`, files: [attachment] });
  },
};
