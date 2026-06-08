const { MessageFlags } = require('discord.js');

module.exports = {
  name: 'record',
  aliases: ['sr'],
  description: 'Records SR progress. Usage: record <knight level> <total medals> <SR mpm>',
  slashOptions: [
    {
      name: 'knight_level',
      description: 'Your current knight level',
      type: 4, // INTEGER
      required: true,
    },
    {
      name: 'total_medals',
      description: 'Your total medals in compact format (e.g., 1.23a for 1.23 × 10³)',
      type: 3, // STRING
      required: true,
    },
    {
      name: 'sr_mpm',
      description: 'Your SR medals per minute in compact format',
      type: 3, // STRING
      required: true,
    },
  ],
  async execute(interaction, args, context) {
    const { db, parseCompactNumber, compactifyNumber, calculateSrPercent, computePercentile, formatNumber } = context;

    const knightLevel = args[0];
    const totalMedalsArg = args[1];
    const srMpmArg = args[2];

    const totalMedalsValue = parseCompactNumber(totalMedalsArg);
    const srMpmValue = parseCompactNumber(srMpmArg);
    const totalMedals = compactifyNumber(totalMedalsArg);
    const srMpm = compactifyNumber(srMpmArg);

    if (!Number.isInteger(knightLevel) || knightLevel <= 0) {
      return interaction.reply({ content: 'Knight level must be a whole number greater than zero.', flags: MessageFlags.Ephemeral });
    }
    if (!Number.isFinite(totalMedalsValue) || totalMedalsValue <= 0) {
      return interaction.reply({ content: 'Total medals must be a positive number.', flags: MessageFlags.Ephemeral });
    }
    if (!Number.isFinite(srMpmValue) || srMpmValue <= 0) {
      return interaction.reply({ content: 'SR mpm must be a positive number.', flags: MessageFlags.Ephemeral });
    }

    const estimatedSrPct = calculateSrPercent(totalMedalsValue, srMpmValue);
    const estimatedDoubleSrPct = Math.min(100, estimatedSrPct * 2);
    const previous = await db.getLatestEntry(interaction.user.id, 'sr');
    const entry = await db.insertProgress({
      userId: interaction.user.id,
      type: 'sr',
      knightLevel,
      totalMedals,
      srMpm,
      estimatedSrPct,
      estimatedDoubleSrPct,
    });

    const lines = [
      `Recorded SR progress for KL ${knightLevel}.`,
      `Estimated SR: ${estimatedSrPct.toFixed(2)}%`,
      `Doubled SR percent: ${estimatedDoubleSrPct.toFixed(2)}%`,
    ];

    if (previous) {
      const klGain = knightLevel - Number(previous.knight_level);
      const previousMedals = parseCompactNumber(previous.total_medals);
      const medalChange = totalMedalsValue - previousMedals;
      const medalGainPercent = previousMedals > 0
        ? ((totalMedalsValue - previousMedals) / previousMedals) * 100
        : 0;
      lines.push(`Previous entry was KL ${previous.knight_level} with ${formatNumber(previous.total_medals)} medals.`);
      lines.push(`KL gain: ${klGain >= 0 ? '+' : ''}${klGain}`);
      lines.push(`Medal change: ${medalChange >= 0 ? '+' : ''}${compactifyNumber(medalChange)} (${medalGainPercent.toFixed(2)}%).`);
    }

    const nearbyEntries = await db.getNearbyEntries(interaction.user.id, 'sr', knightLevel, 5, entry.id);
    if (nearbyEntries.length > 0) {
      const scores = nearbyEntries.map((row) => Number(row.estimated_sr_pct));
      const grade = computePercentile(Number(estimatedSrPct), scores);
      lines.push(`Your current SR grade is ${grade}% compared to ${nearbyEntries.length} nearby entries.`);
    } else {
      lines.push('No nearby entries found for grade comparison. Record more SR progress to build your grade profile.');
    }

    return interaction.reply({ content: lines.join('\n'), flags: MessageFlags.Ephemeral });
  },
};
