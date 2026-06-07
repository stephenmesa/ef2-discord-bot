module.exports = {
  name: 'record',
  aliases: ['sr'],
  description: 'Records SR progress. Usage: record <knight level> <total medals> <SR mpm>',
  async execute(message, args, context) {
    const { db, parseCompactNumber, compactifyNumber, calculateSrPercent, computePercentile, formatNumber } = context;

    if (args.length < 3) {
      return message.reply('Usage: record <knight level> <total medals> <SR mpm>');
    }

    const knightLevel = parseInt(args[0], 10);
    const totalMedalsValue = parseCompactNumber(args[1]);
    const srMpmValue = parseCompactNumber(args[2]);
    const totalMedals = compactifyNumber(args[1]);
    const srMpm = compactifyNumber(args[2]);

    if (!Number.isInteger(knightLevel) || knightLevel <= 0) {
      return message.reply('Knight level must be a whole number greater than zero.');
    }
    if (!Number.isFinite(totalMedalsValue) || totalMedalsValue <= 0) {
      return message.reply('Total medals must be a positive number.');
    }
    if (!Number.isFinite(srMpmValue) || srMpmValue <= 0) {
      return message.reply('SR mpm must be a positive number.');
    }

    const estimatedSrPct = calculateSrPercent(totalMedalsValue, srMpmValue);
    const estimatedDoubleSrPct = Math.min(100, estimatedSrPct * 2);
    const previous = await db.getLatestEntry(message.author.id, 'sr');
    const entry = await db.insertProgress({
      userId: message.author.id,
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
      lines.push(`Medal change: ${medalChange >= 0 ? '+' : ''}${formatNumber(medalChange)} (${medalGainPercent.toFixed(2)}%).`);
    }

    const nearbyEntries = await db.getNearbyEntries(message.author.id, 'sr', knightLevel, 5, entry.id);
    if (nearbyEntries.length > 0) {
      const scores = nearbyEntries.map((row) => Number(row.estimated_sr_pct));
      const grade = computePercentile(Number(estimatedSrPct), scores);
      lines.push(`Your current SR grade is ${grade}% compared to ${nearbyEntries.length} nearby entries.`);
    } else {
      lines.push('No nearby entries found for grade comparison. Record more SR progress to build your grade profile.');
    }

    return message.reply(lines.join('\n'));
  },
};
