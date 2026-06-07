module.exports = {
  name: 'graph',
  aliases: [],
  description: 'Generates a progress chart PNG. Usage: graph [kl|medals]',
  slashOptions: [
    {
      name: 'mode',
      description: 'Chart mode: combined (default), kl, or medals',
      type: 3, // STRING
      required: false,
      choices: [
        { name: 'Combined', value: 'combined' },
        { name: 'Knight Level', value: 'kl' },
        { name: 'Medals', value: 'medals' },
      ],
    },
  ],
  async execute(interaction, args, context) {
    const { db, buildChartBuffer } = context;
    const { AttachmentBuilder } = require('discord.js');

    const modeArg = args[0] || 'combined';
    const mode = ['combined', 'kl', 'medals'].includes(modeArg) ? modeArg : 'combined';

    const rows = await db.getAllEntries(interaction.user.id, 'sr', 200);
    if (!rows.length) {
      return interaction.reply('No SR entries found. Record progress to generate a graph.');
    }

    const buffer = await buildChartBuffer(rows, mode);
    const attachment = new AttachmentBuilder(buffer, { name: `sr-graph-${mode}.png` });
    return interaction.reply({ content: `Here is your SR ${mode === 'combined' ? 'progress' : mode} chart.`, files: [attachment] });
  },
};
