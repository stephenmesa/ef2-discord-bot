const QuickChart = require('quickchart-js');
const { EmbedBuilder } = require('discord.js');

function parseCompactNumber(value) {
  if (value === undefined || value === null) return NaN;

  const raw = String(value).trim().toLowerCase();
  if (raw.length === 0) return NaN;

  const numeric = Number(raw.replace(/,/g, ''));
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
  return `ID ${row.id} — KL ${row.knight_level} — Medals ${formatNumber(row.total_medals)} — SR mpm ${formatNumber(row.sr_mpm)} — SR ${Number(row.estimated_sr_pct).toFixed(2)}% — Double SR ${Number(row.estimated_double_sr_pct).toFixed(2)}%`;
}

function parseEntryType(type) {
  if (!type) return 'sr';
  const normalized = String(type).trim().toLowerCase();
  if (normalized === 'sr') {
    return 'sr';
  }
  return null;
}

function computePercentile(currentValue, values) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const countLess = sorted.filter((value) => value < currentValue).length;
  const countEqual = sorted.filter((value) => value === currentValue).length;
  const rank = countLess + countEqual / 2;
  return Math.round((rank / sorted.length) * 100);
}

async function buildChartBuffer(entries, mode = 'combined') {
  const width = 1000;
  const height = 540;
  const labels = entries.map((entry) => {
    const date = new Date(entry.created_at);
    return date.toISOString().slice(0, 16).replace('T', ' ');
  });

  const datasets = [];
  const levels = entries.map((entry) => Number(entry.knight_level));
  const medals = entries.map((entry) => parseCompactNumber(entry.total_medals));

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
  const header = ['ID', 'Type', 'Knight Level', 'Total Medals', 'SR mpm', 'Estimated SR %', 'Doubled SR %', 'Created At'];
  const lines = [header.join(',')];
  for (const row of rows) {
    const values = [
      row.id,
      row.entry_type,
      row.knight_level,
      row.total_medals,
      row.sr_mpm,
      Number(row.estimated_sr_pct).toFixed(2),
      Number(row.estimated_double_sr_pct).toFixed(2),
      new Date(row.created_at).toISOString(),
    ];
    lines.push(values.map((value) => JSON.stringify(value)).join(','));
  }
  return Buffer.from(lines.join('\n'), 'utf8');
}

function buildFooter() {
    return { text: 'EF2Bot by @stephenmesa' };
}

function getEmbedColor() {
    return 0x5865F2; // Discord Blurple, or use a custom hex like '#7289da'
}

function buildGradeEmbed(record, grade, nearbyCount) {
  const srEfficiency = 0.8; // Assume 80% efficiency for SR for now
  const totalMinutes = 4 * 60;
  const medalsGained = parseCompactNumber(record.sr_mpm) * totalMinutes * srEfficiency;

  return new EmbedBuilder()
    .setColor(getEmbedColor())
    .setTitle('✨ Latest Soul Rest Entry')
    .setDescription(`Here is the current grading breakdown for your entry.`)
    .addFields(
        { name: '🆔 Entry ID', value: `${record.id}`, inline: true },
        { name: '⚔️ Knight Level', value: `${record.knight_level}`, inline: true },
        { name: '🏅 Medals', value: `${formatNumber(record.total_medals)}`, inline: true },
    )
    .addFields(
        { name: '📊 SR MPM', value: `**${formatNumber(record.sr_mpm)}**`, inline: true },
        { name: '📈 SR %', value: `**${Number(record.estimated_sr_pct).toFixed(2)}%** (${compactifyNumber(medalsGained)} medals gained)`, inline: true },
        { name: '⚡ Double SR %', value: `**${Number(record.estimated_double_sr_pct).toFixed(2)}%** (${compactifyNumber(medalsGained * 2)} medals gained)`, inline: true },
    )
    .addFields(
        { 
            name: '🏆 Grade Percentile', 
            value: `**${grade}** *(among ${nearbyCount} nearby KL ${nearbyCount === 1 ? 'entry' : 'entries'})*`, 
            inline: false 
        }
    )
    .setTimestamp(record.created_at)
    .setFooter(buildFooter());
}

module.exports = {
  parseCompactNumber,
  compactifyNumber,
  clamp,
  formatNumber,
  formatAge,
  formatEntry,
  parseEntryType,
  computePercentile,
  buildChartBuffer,
  buildProgressCsv,
  buildFooter,
  getEmbedColor,
  buildGradeEmbed,
};
