const { MessageFlags } = require('discord.js');
const {
  formatNumber,
  compactifyNumber,
  parseCompactNumber,
  getPercentile,
  validatePercentage,
  calculateBaseMpm,
} = require('../utils');

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
      description: 'Your total medals in compact format (e.g., 1.23a for 1.23 x 10³)',
      type: 3, // STRING
      required: true,
    },
    {
      name: 'sr_mpm',
      description: 'Your SR medals per minute in compact format',
      type: 3, // STRING
      required: true,
    },
    {
      name: 'medal_buff_percent',
      description: 'Your rebirth medal bonus percentage. (e.g. 1282 for 1282%)',
      type: 3, // STRING
      required: false,
    },
  ],
  async execute(interaction, args, context) {
    const { db } = context;

    const knightLevel = args[0];
    const totalMedalsArg = args[1];
    const srMpmArg = args[2];
    const rebirthMedalBonus = args[3];

    const totalMedalsValue = parseCompactNumber(totalMedalsArg);
    const srMpmValue = parseCompactNumber(srMpmArg);
    const rebirthMedalBonusValue = Number(rebirthMedalBonus);
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
    if (!!rebirthMedalBonus && (!Number.isFinite(rebirthMedalBonusValue) || rebirthMedalBonusValue <= 0)) {
      return interaction.reply({ content: 'Medal buff percent must be a positive number.', flags: MessageFlags.Ephemeral });
    }

    const srEfficiency = 0.8; // Assume 80% efficiency for SR for now
    const totalMinutes = 4 * 60;
    const medalsGained = srMpmValue * totalMinutes * srEfficiency;

    const estimatedSrPct = (medalsGained / totalMedalsValue) * 100;
    const estimatedDoubleSrPct = ((medalsGained * 2) / totalMedalsValue) * 100;

    let baseEstimatedSrPct;
    let baseEstimatedDoubleSrPct;
    let baseSRMpm;
    let baseSRMpmValue;

    // Optionally calculate normalized SR Percent if Rebirth Medal Bonus is provided
    if (!!rebirthMedalBonus) {
      baseSRMpmValue = calculateBaseMpm(srMpmValue, rebirthMedalBonusValue);

      baseSRMpm = compactifyNumber(baseSRMpmValue);
      const baseMedalsGained = baseSRMpmValue * totalMinutes * srEfficiency;
      baseEstimatedSrPct = (baseMedalsGained / totalMedalsValue) * 100;
      baseEstimatedDoubleSrPct = ((baseMedalsGained * 2) / totalMedalsValue) * 100;
    }

    const previous = await db.getLatestEntry(interaction.user.id, 'sr');
    const entry = await db.insertProgress({
      userId: interaction.user.id,
      type: 'sr',
      knightLevel,
      totalMedals,
      srMpm,
      estimatedSrPct,
      estimatedDoubleSrPct,
      rebirthMedalBonus,
      baseSRMpm,
      baseEstimatedSrPct,
      baseEstimatedDoubleSrPct,
    });

    const lines = [
      `Recorded SR progress for KL ${knightLevel}.`,
      `Estimated SR: ${estimatedSrPct.toFixed(2)}% (${compactifyNumber(medalsGained)} medals gained)`,
      `Doubled SR: ${estimatedDoubleSrPct.toFixed(2)}% (${compactifyNumber(medalsGained * 2)} medals gained)`,
      `MPM: ${srMpm}`,
    ];

    if (!!rebirthMedalBonus) {
      lines.push(`Medal Buff %: ${rebirthMedalBonus}%`);
      lines.push(`Base MPM: ${baseSRMpm} (This is your MPM without the medal buff %, for ease of comparing across players)`);
    }

    if (previous) {
      const klGain = knightLevel - Number(previous.knightLevel);
      const previousMedals = parseCompactNumber(previous.totalMedals);
      const medalChange = totalMedalsValue - previousMedals;
      const medalGainPercent = previousMedals > 0
        ? ((totalMedalsValue - previousMedals) / previousMedals) * 100
        : 0;
      lines.push(`Previous entry was KL ${previous.knightLevel} with ${formatNumber(previous.totalMedals)} medals.`);
      lines.push(`KL gain: ${klGain >= 0 ? '+' : ''}${klGain}`);
      lines.push(`Medal change: ${medalChange >= 0 ? '+' : ''}${compactifyNumber(medalChange)} (${medalGainPercent.toFixed(2)}%).`);
    }

    const nearbyEntries = await db.getNearbyEntries('sr', knightLevel, 1, entry.id);
    if (nearbyEntries.length > 0) {
      const allPercentages = nearbyEntries.map((row) => Number(row.estimatedSrPercent)).filter(validatePercentage);
      const scoreDecimal = getPercentile(allPercentages, estimatedSrPct);
      const score = Math.round(scoreDecimal);

      lines.push(`Your current SR grade is ${score}/100 compared to ${nearbyEntries.length} nearby KL entries.`);
    } else {
      lines.push('No nearby KL entries found for grade comparison. Record more SR progress to build your grade profile.');
    }

    return interaction.reply({ content: lines.join('\n'), flags: MessageFlags.Ephemeral });
  },
};
