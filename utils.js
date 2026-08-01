const QuickChart = require('quickchart-js');
const { EmbedBuilder } = require('discord.js');

function parseCompactNumber(value) {
  if (value === undefined || value === null) return NaN;

  const raw = String(value).trim().toLowerCase().replace(/,/g, '.');
  if (raw.length === 0) return NaN;

  const numeric = Number(raw);
  if (!Number.isNaN(numeric)) {
    return numeric;
  }

  // Support compact notation with optional decimals: "92.8b" or "92b"
  // Single or multiple letters: a-z, aa-az, ba-bz, etc.
  const compactMatch = raw.match(/^([0-9.]+)([a-z]+)$/i);
  if (compactMatch) {
    const numberPart = Number(compactMatch[1]);
    const letters = compactMatch[2].toLowerCase();
    
    // Convert letter sequence to base-26 index (like Excel columns)
    // a=1, b=2, ..., z=26, aa=27, ab=28, ...
    let letterIndex = 0;
    for (let i = 0; i < letters.length; i++) {
      letterIndex = letterIndex * 26 + (letters.charCodeAt(i) - 'a'.charCodeAt(0) + 1);
    }
    
    // Calculate exponent: 10^(3N) where N = letterIndex
    const exponent = 3 * letterIndex;
    return numberPart * Math.pow(10, exponent);
  }

  return NaN;
}

const compactifyNumber = (value) => {
  const formatCompactCoefficient = (value) => {
    const absValue = Math.abs(value);
    if (absValue >= 100) {
      return value.toFixed(0);
    }
    if (absValue >= 10) {
      return value.toFixed(1);
    }
    return value.toFixed(2);
  };

  const compactSuffix = (index) => {
    let suffix = '';
    let current = index;
    while (current > 0) {
      const remainder = (current - 1) % 26;
      suffix = String.fromCharCode(97 + remainder) + suffix;
      current = Math.floor((current - 1) / 26);
    }
    return suffix;
  }

  if (value === undefined || value === null) return null;

  const raw = String(value).trim().toLowerCase();
  if (raw.length === 0) return null;

  const compactMatch = raw.match(/^([0-9]+(?:\.[0-9]+)?)([a-z]+)$/i);
  if (compactMatch) {
    const numberPart = Number(compactMatch[1]);
    if (Number.isNaN(numberPart)) return null;

    const coefficient = compactMatch[1];
    const digitsOnly = coefficient.replace('.', '');
    if (digitsOnly.length <= 3) {
      const preserved = coefficient.replace(/\.0+$/, '');
      return `${preserved}${compactMatch[2].toLowerCase()}`;
    }

    return `${formatCompactCoefficient(numberPart)}${compactMatch[2].toLowerCase()}`;
  }

  const numeric = Number(raw.replace(/,/g, ''));
  if (Number.isNaN(numeric)) return null;

  if (Math.abs(numeric) < 1000) {
    return Number.isInteger(numeric) ? numeric.toString() : Number(numeric.toFixed(3)).toString();
  }

  let exponent = Math.floor(Math.log10(Math.abs(numeric)) / 3) * 3;
  let suffixIndex = exponent / 3;
  let reduced = numeric / Math.pow(10, exponent);
  let compactValue = formatCompactCoefficient(reduced);

  if (Math.abs(Number(compactValue)) >= 1000) {
    reduced /= 1000;
    suffixIndex += 1;
    compactValue = formatCompactCoefficient(reduced);
  }

  return `${compactValue}${compactSuffix(suffixIndex)}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatNumber(value) {
  if (value === null || value === undefined) {
    return String(value);
  }

  const raw = String(value).trim();
  if (/^[0-9]+(?:\.[0-9]+)?[a-z]+$/i.test(raw)) {
    return raw.toLowerCase();
  }

  const numeric = Number(raw.replace(/,/g, ''));
  if (Number.isNaN(numeric)) {
    return raw;
  }
  return numeric.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function formatAge(timestamp) {
  const then = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const now = new Date();
  const diff = Math.max(0, now - then);
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h ago`;
  if (hours > 0) return `${hours}h ${minutes % 60}m ago`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s ago`;
  return `${seconds}s ago`;
}

function formatEntry(row) {
  const dataPoints = [];

  dataPoints.push(`ID ${row.id}`);
  dataPoints.push(`KL ${row.knightLevel}`);
  dataPoints.push(`Medals ${formatNumber(row.totalMedals)}`);
  dataPoints.push(`SR mpm ${formatNumber(row.srMpm)}`);
  dataPoints.push(`SR ${Number(row.estimatedSrPercent).toFixed(2)}%`);
  dataPoints.push(`Double SR ${Number(row.estimatedSrPercentDouble).toFixed(2)}%`);
  if (row.rebirthMedalBonus) {
    dataPoints.push(`Rebirth Medal Bonus ${row.rebirthMedalBonus}%`);
  }
  if (row.baseSrMpm) {
    dataPoints.push(`Base SR mpm ${row.baseSrMpm}`);
  }
  return dataPoints.join(' — ');
}

function parseEntryType(type) {
  if (!type) return 'sr';
  const normalized = String(type).trim().toLowerCase();
  if (normalized === 'sr') {
    return 'sr';
  }
  return null;
}

async function buildChartBuffer(entries, mode = 'combined') {
  const width = 1000;
  const height = 540;
  const labels = entries.map((entry) => {
    const date = new Date(entry.createdAt);
    return date.toISOString().slice(0, 16).replace('T', ' ');
  });

  const datasets = [];
  const levels = entries.map((entry) => Number(entry.knightLevel));
  const medals = entries.map((entry) => parseCompactNumber(entry.totalMedals));
  const mpmValues = entries.map((entry) => parseCompactNumber(entry.srMpm));

  if (mode === 'combined' || mode === 'kl') {
    datasets.push({
      label: 'Knight Level',
      data: levels,
      borderColor: '#2f80ed',
      backgroundColor: '#2f80ed',
      yAxisID: 'y',
      tension: 0.18,
      fill: false,
    });
  }

  if (mode === 'combined' || mode === 'medals') {
    datasets.push({
      label: 'Total Medals',
      data: medals,
      borderColor: '#27ae60',
      backgroundColor: '#27ae60',
      yAxisID: mode === 'medals' ? 'y' : 'y1',
      tension: 0.18,
      fill: false,
    });
  }

  if (mode === 'mpm') {
    datasets.push({
      label: 'MPM',
      data: mpmValues,
      borderColor: '#f2994a',
      backgroundColor: '#f2994a',
      yAxisID: 'y',
      tension: 0.18,
      fill: false,
    });
  }

  const options = {
    responsive: true,
    legend: { position: 'top' },
    title: { display: true, text: `SR Progress Chart (${mode.toUpperCase()})` },
    scales: {
      xAxes: [
        {
          scaleLabel: { display: true, labelString: 'Recorded At' },
        },
      ],
      yAxes: [
        {
          id: 'y',
          type: 'linear',
          position: 'left',
          scaleLabel: { display: true, labelString: 'Knight Level' },
          display: mode !== 'medals' || mode === 'kl',
        },
        {
          id: 'y1',
          type: mode === 'medals' ? 'logarithmic' : 'linear',
          position: 'right',
          scaleLabel: { display: true, labelString: 'Total Medals' },
          min: 1,
          display: mode !== 'kl',
          ticks: {
            callback: compactifyNumber,
          },
        },
      ],
    },
  };

  if (mode === 'kl') {
    options.scales = {
      xAxes: options.scales.xAxes,
      yAxes: [
        {
          id: 'y',
          type: 'linear',
          position: 'left',
          scaleLabel: { display: true, labelString: 'Knight Level' },
        },
      ],
    };
  }

  if (mode === 'medals') {
    options.scales = {
      xAxes: options.scales.xAxes,
      yAxes: [
        {
          id: 'y',
          type: 'logarithmic',
          position: 'left',
          scaleLabel: { display: true, labelString: 'Total Medals' },
          min: Math.max(1, Math.min(...medals.map((v) => Math.max(1, v)))),
          ticks: {
            callback: compactifyNumber,
          },
        },
      ],
    };
  }

  if (mode === 'mpm') {
    options.scales = {
      xAxes: options.scales.xAxes,
      yAxes: [
        {
          id: 'y',
          type: 'linear',
          position: 'left',
          scaleLabel: { display: true, labelString: 'MPM' },
          min: Math.max(1, Math.min(...mpmValues.map((v) => Math.max(1, v)))),
          ticks: {
            callback: compactifyNumber,
          },
        },
      ],
    };
  }

  const configuration = {
    type: 'line',
    data: { labels, datasets },
    options,
  };

  const chart = new QuickChart();
  chart.setConfig(configuration);
  chart.setWidth(width);
  chart.setHeight(height);
  chart.setBackgroundColor('white');
  return chart.toBinary();
}

function buildProgressCsv(rows) {
  const includeReason = rows.some((row) => row.outlierReason !== undefined);
  const header = ['ID', 'Type', 'Knight Level', 'Total Medals', 'SR mpm', 'Estimated SR %', 'Doubled SR %', 'Created At', 'Rebirth Medal Bonus', 'Base SR MPM', 'Estimated Base SR %', 'Doubled Base SR %'];
  if (includeReason) {
    header.push('Reason');
  }
  const lines = [header.join(',')];
  for (const row of rows) {
    const values = [
      row.id,
      row.entryType,
      row.knightLevel,
      row.totalMedals,
      row.srMpm,
      Number(row.estimatedSrPercent).toFixed(2),
      Number(row.estimatedSrPercentDouble).toFixed(2),
      new Date(row.createdAt).toISOString(),
      row.rebirthMedalBonus,
      row.baseSrMpm,
      row.baseEstimatedSrPercent ? Number(row.baseEstimatedSrPercent).toFixed(2) : null,
      row.baseEstimatedSrPercentDouble ? Number(row.baseEstimatedSrPercentDouble).toFixed(2) : null,
    ];
    if (includeReason) {
      values.push(row.outlierReason || '');
    }
    lines.push(values.map((value) => JSON.stringify(value)).join(','));
  }
  return Buffer.from(lines.join('\n'), 'utf8');
}

function buildFooter(showBaseDisclaimer = false) {
  const baseDisclaimer = showBaseDisclaimer ? 'Note: Base SR MPM is your MPM without the medal buff %, for ease of comparing across players.\n' : '';
  return { text: `${baseDisclaimer}EF2Bot by @stephenmesa` };
}

function getEmbedColor() {
    return 0x5865F2; // Discord Blurple, or use a custom hex like '#7289da'
}

function buildGradeEmbed(record, assessment) {
  const srEfficiency = 0.8; // Assume 80% efficiency for SR for now
  const totalMinutes = 4 * 60;
  const medalsGained = parseCompactNumber(record.srMpm) * totalMinutes * srEfficiency;

  const klFields = Object.entries(assessment.kls).map(([groupKL, klAssessment]) => ({
    name: `KL${groupKL} (${klAssessment.n} record${klAssessment.n > 1 ? 's' : ''})`,
    value: `${klAssessment.percentageMin}%-${klAssessment.percentageMax}%`,
    inline: true,
  }));

  let description = assessment.score
    ? `Your SR grade is **${assessment.score}/100**`
    : 'Sorry, but your grade could not be calculated based on lack of data';

  if (assessment.baseScore) {
    description += `
    Your Base SR grade is **${assessment.baseScore}/100**`;
  }

  const baseFields = [];
  if (record.baseSrMpm) {
    baseFields.push({
      name: 'Base SR MPM',
      value: `**${formatNumber(record.baseSrMpm)}**`,
      inline: true,
    });
    baseFields.push({
      name: 'Base SR %',
      value: `**${Number(record.baseEstimatedSrPercent).toFixed(2)}%**`,
      inline: true,
    });
    baseFields.push({
      name: 'Base Double SR %',
      value: `**${Number(record.baseEstimatedSrPercentDouble).toFixed(2)}%**`,
      inline: true,
    });
  }

  return new EmbedBuilder()
    .setColor(getEmbedColor())
    .setTitle('✨ Latest Soul Rest Entry')
    .setDescription(description)
    .addFields(
        { name: '🆔 Entry ID', value: `${record.id}`, inline: true },
        { name: '⚔️ Knight Level', value: `${record.knightLevel}`, inline: true },
        { name: '🏅 Medals', value: `${formatNumber(record.totalMedals)}`, inline: true },
    )
    .addFields(
        { name: '📊 SR MPM', value: `**${formatNumber(record.srMpm)}**`, inline: true },
        { name: '📈 SR %', value: `**${Number(record.estimatedSrPercent).toFixed(2)}%** (${compactifyNumber(medalsGained)} medals gained)`, inline: true },
        { name: '⚡ Double SR %', value: `**${Number(record.estimatedSrPercentDouble).toFixed(2)}%** (${compactifyNumber(medalsGained * 2)} medals gained)`, inline: true },
    )
    .addFields(
      ...baseFields,
    )
    .addFields(
        ...klFields,
    )
    .setTimestamp(record.createdAt)
    .setFooter(buildFooter(!!record.baseSrMpm));
}

function getPercentile(arr, num) {
  if (arr.length === 0) return 0;

  // 1. Count how many numbers are less than or equal to the target number
  const count = arr.filter(item => item <= num).length;

  // 2. Calculate the percentage
  const percentile = (count / arr.length) * 100;

  // 3. Round to a clean whole number (or use .toFixed(2) if you want decimals)
  return Math.round(percentile);
}

// Let's assume that it's impossible to achieve an SR rate above 100%
// (usually it's below 10%, so this should be fairly conservative)
function validatePercentage(p) {
  return typeof p === 'number' && !isNaN(p) && p >= 0 && p <= 100;
}

function filterOutlierProgresses(records) {
  return records.filter(record => validatePercentage(record.percentage));
}

function filterOutlierBaseProgresses(records) {
  return records.filter(record => validatePercentage(record.basePercentage));
}

function calculateBaseMpm(mpm, rebirthMedalBonus) {
  if (rebirthMedalBonus == null || mpm == null) {
    return null;
  }

  const srMpmValue = Number(mpm);
  const rebirthMedalBonusValue = Number(rebirthMedalBonus);
  if (!Number.isFinite(rebirthMedalBonusValue)
    || !Number.isFinite(srMpmValue)
    || rebirthMedalBonusValue < 0
    || srMpmValue < 0) {
    // The rebirth medal bonus was not provided, and thus the base MPM cannot be calculated. Return early.
    return null;
  }

  return srMpmValue / (1 + rebirthMedalBonusValue / 100);
}

function calculateSrPercentage(mpm, totalMedals, srEfficiency = 0.8) {
  if (!mpm || !Number.isFinite(mpm) || !totalMedals | !Number.isFinite(totalMedals)) {
    return null;
  }
  const totalMinutes = 4 * 60; // 4 hours
  const medalsGained = mpm * totalMinutes * srEfficiency;

  return (medalsGained / totalMedals) * 100;
}

function assessProgress(currentProgress, comparableProgresses) {
  const { percentage, basePercentage } = currentProgress;

  const filteredProgresses = filterOutlierProgresses(comparableProgresses);
  const allPercentages = filteredProgresses.map(p => p.percentage);

  const klProgresses = Object.groupBy(filteredProgresses, ({ kl }) => kl);

  const kls = Object.fromEntries(
    Object.entries(klProgresses).map(([key, progresses]) => {
      const percentages = progresses.map(e => e.percentage);
      const percentageMin = Math.min(...percentages);
      const percentageMax = Math.max(...percentages);
      const n = progresses.length;

      return [
        key,
        {
          n,
          percentageMin: Number(percentageMin.toFixed(2)),
          percentageMax: Number(percentageMax.toFixed(2)),
        }
      ];
    })
  );

  const filteredBaseProgresses = filterOutlierBaseProgresses(comparableProgresses);
  const allBasePercentages = filteredBaseProgresses.map(p => p.basePercentage);

  const klBaseProgresses = Object.groupBy(filteredBaseProgresses, ({ kl }) => kl);

  const baseKLs = Object.fromEntries(
    Object.entries(klBaseProgresses).map(([key, progresses]) => {
      const basePercentages = filteredBaseProgresses.map(e => e.basePercentage);
      const basePercentageMin = Math.min(...basePercentages);
      const basePercentageMax = Math.max(...basePercentages);
      const n = filteredBaseProgresses.length;

      return [
        key,
        {
          n,
          percentageMin: Number(basePercentageMin.toFixed(2)),
          percentageMax: Number(basePercentageMax.toFixed(2)),
        }
      ];
    })
  );

  // Calculate standard score
  let score = null;
  if (filteredProgresses.length > 0) {
    const scoreDecimal = getPercentile(allPercentages, percentage);
    score = Math.round(scoreDecimal);
  }

  // Calculate optional base score
  let baseScore = null;

  // Only proceed if the current entry actually provided a valid medal bonus
  if (Number.isFinite(basePercentage) && filteredBaseProgresses.length > 0) {
    const baseScoreDecimal = getPercentile(allBasePercentages, basePercentage)
    baseScore = Math.round(baseScoreDecimal);
  }

  return {
    kls,
    score,
    baseScore,
  };
}

async function buildScatterChartBuffer(entries, metric = 'standard') {
  const width = 1000;
  const height = 540;

  const dataPoints = entries
    .map((entry) => {
      const kl = Number(entry.knight_level || entry.knightLevel);
      const mpmStr = metric === 'base' ? (entry.base_sr_mpm || entry.baseSrMpm) : (entry.sr_mpm || entry.srMpm);
      const mpm = parseCompactNumber(mpmStr);
      return { x: kl, y: mpm };
    })
    .filter((pt) => !Number.isNaN(pt.x) && pt.x > 0 && pt.x <= 1000 && !Number.isNaN(pt.y) && pt.y > 0);

  const datasetLabel = metric === 'base' ? 'Base MPM' : 'Standard MPM';
  const yValues = dataPoints.map((pt) => pt.y);
  const yMin = yValues.length > 0 ? Math.max(1, Math.min(...yValues)) : 1;

  const configuration = {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: datasetLabel,
          data: dataPoints,
          backgroundColor: '#f2994a',
          borderColor: '#f2994a',
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      title: {
        display: true,
        text: `Every ${metric === 'base' ? 'Base ' : ''}MPM across Knight Levels`,
      },
      scales: {
        xAxes: [
          {
            type: 'linear',
            position: 'bottom',
            scaleLabel: {
              display: true,
              labelString: 'Knight Level',
            },
            ticks: {
              precision: 0,
            },
          },
        ],
        yAxes: [
          {
            type: 'logarithmic',
            position: 'left',
            scaleLabel: {
              display: true,
              labelString: metric === 'base' ? 'Base MPM' : 'Standard MPM',
            },
            min: yMin,
            ticks: {
              callback: compactifyNumber,
            },
          },
        ],
      },
    },
  };

  const chart = new QuickChart();
  chart.setConfig(configuration);
  chart.setWidth(width);
  chart.setHeight(height);
  chart.setBackgroundColor('white');
  return chart.toBinary();
}

module.exports = {
  parseCompactNumber,
  compactifyNumber,
  clamp,
  formatNumber,
  formatAge,
  formatEntry,
  parseEntryType,
  buildChartBuffer,
  buildScatterChartBuffer,
  buildProgressCsv,
  buildFooter,
  getEmbedColor,
  buildGradeEmbed,
  assessProgress,
  filterOutlierProgresses,
  validatePercentage,
  getPercentile,
  calculateBaseMpm,
  calculateSrPercentage,
};
