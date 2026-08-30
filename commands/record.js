const { MessageFlags } = require('discord.js');
const {
  compactifyNumber,
  parseCompactNumber,
  calculateBaseMpm,
  assessProgress,
  buildGradeEmbed,
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

    const knightLevelArg = interaction.options?.getInteger ? interaction.options.getInteger('knight_level') : args?.[0];
    const totalMedalsArg = interaction.options?.getString ? interaction.options.getString('total_medals') : args?.[1];
    const srMpmArg = interaction.options?.getString ? interaction.options.getString('sr_mpm') : args?.[2];
    const rebirthMedalBonus = interaction.options?.getString ? interaction.options.getString('medal_buff_percent') : args?.[3];

    const knightLevel = Number(knightLevelArg);
    const totalMedalsValue = parseCompactNumber(totalMedalsArg);
    const srMpmValue = parseCompactNumber(srMpmArg);
    const rebirthMedalBonusValue = Number(rebirthMedalBonus);
    const totalMedals = compactifyNumber(totalMedalsArg);
    const srMpm = compactifyNumber(srMpmArg);

    const maxKnightLevel = process.env.MAX_KNIGHT_LEVEL ? Number(process.env.MAX_KNIGHT_LEVEL) : 1000;
    const maxTotalMedalsLimit = parseCompactNumber(process.env.MAX_TOTAL_MEDALS || '1.00f');
    const maxSrMpmLimit = parseCompactNumber(process.env.MAX_SR_MPM || '1.00d');
    const maxMedalBuffPercent = process.env.MAX_MEDAL_BUFF_PERCENT ? Number(process.env.MAX_MEDAL_BUFF_PERCENT) : 20000;

    const highestMetrics = await db.getHighestMetrics?.('sr');
    const { highestKnightLevel, highestTotalMedals, highestSrMpm } = highestMetrics || {};

    if (!Number.isInteger(knightLevel) || knightLevel <= 0) {
      return interaction.reply({ content: 'Knight level must be a whole number greater than zero.', flags: MessageFlags.Ephemeral });
    }
    if (knightLevel >= maxKnightLevel) {
      return interaction.reply({ content: `Knight level must be below ${maxKnightLevel}.`, flags: MessageFlags.Ephemeral });
    }
    if (highestKnightLevel !== null && highestKnightLevel !== undefined && knightLevel >= 2 * highestKnightLevel) {
      return interaction.reply({ content: `Knight level must be less than twice the highest recorded knight level (${2 * highestKnightLevel}).`, flags: MessageFlags.Ephemeral });
    }

    if (!Number.isFinite(totalMedalsValue) || totalMedalsValue <= 1000) {
      return interaction.reply({ content: 'Total medals must be greater than 1000 (1.00a).', flags: MessageFlags.Ephemeral });
    }
    if (totalMedalsValue >= maxTotalMedalsLimit) {
      return interaction.reply({ content: `Total medals must be below ${compactifyNumber(maxTotalMedalsLimit)}.`, flags: MessageFlags.Ephemeral });
    }
    if (highestTotalMedals !== null && highestTotalMedals !== undefined && totalMedalsValue >= 2 * highestTotalMedals) {
      return interaction.reply({ content: `Total medals must be less than twice the highest recorded total medals (${compactifyNumber(2 * highestTotalMedals)}).`, flags: MessageFlags.Ephemeral });
    }

    if (!Number.isFinite(srMpmValue) || srMpmValue <= 600) {
      return interaction.reply({ content: 'SR mpm must be greater than 600.', flags: MessageFlags.Ephemeral });
    }
    if (srMpmValue >= maxSrMpmLimit) {
      return interaction.reply({ content: `SR mpm must be below ${compactifyNumber(maxSrMpmLimit)}.`, flags: MessageFlags.Ephemeral });
    }
    if (highestSrMpm !== null && highestSrMpm !== undefined && srMpmValue >= 2 * highestSrMpm) {
      return interaction.reply({ content: `SR mpm must be less than twice the highest recorded SR mpm (${compactifyNumber(2 * highestSrMpm)}).`, flags: MessageFlags.Ephemeral });
    }

    if (!!rebirthMedalBonus && (!Number.isFinite(rebirthMedalBonusValue) || rebirthMedalBonusValue <= 0 || rebirthMedalBonusValue >= maxMedalBuffPercent)) {
      return interaction.reply({ content: `Medal buff percent must be above 0 and below ${maxMedalBuffPercent}.`, flags: MessageFlags.Ephemeral });
    }

    const srEfficiency = 0.8; // Assume 80% efficiency for SR for now
    const totalMinutes = 4 * 60;
    const medalsGained = srMpmValue * totalMinutes * srEfficiency;

    const estimatedSrPct = (medalsGained / totalMedalsValue) * 100;

    if (!Number.isFinite(estimatedSrPct) || estimatedSrPct <= 0 || estimatedSrPct >= 100) {
      return interaction.reply({ content: 'SR percentage must be above 0% and below 100%.', flags: MessageFlags.Ephemeral });
    }
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

    const nearbyEntries = await db.getNearbyEntries('sr', knightLevel, 1, entry.id);
    const progresses = nearbyEntries.map((row) => ({
      kl: Number(row.knightLevel),
      percentage: row.estimatedSrPercent,
      basePercentage: row.baseEstimatedSrPercent ? Number(row.baseEstimatedSrPercent) : null,
    }));
    const assessment = assessProgress({
      percentage: entry.estimatedSrPercent,
      basePercentage: entry.baseEstimatedSrPercent ? Number(entry.baseEstimatedSrPercent) : null,
    }, progresses);

    const embed = buildGradeEmbed(entry, assessment, {
      title: '✨ Recorded Soul Rest Entry',
      previous,
    });

    return interaction.reply({
      embeds: [embed],
      flags: MessageFlags.Ephemeral,
    });
  },
};
