const QuickChart = require('quickchart-js');

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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return String(value);
  }
  return Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 });
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
  if (['sr', 'raid'].includes(normalized)) {
    return normalized;
  }
  return null;
}

function calculateSrPercent(totalMedals, srMpm) {
  const ratio = Number(srMpm) / Math.max(1, Number(totalMedals));
  const percent = ratio * 100000;
  return clamp(percent, 0.01, 100);
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
  const medals = entries.map((entry) => Number(entry.total_medals));

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
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: `SR Progress Chart (${mode.toUpperCase()})` },
    },
    scales: {
      x: { title: { display: true, text: 'Recorded At' } },
      y: {
        type: 'linear',
        display: mode !== 'medals' || mode === 'kl',
        position: 'left',
        title: { display: true, text: 'Knight Level' },
      },
      y1: {
        type: mode === 'medals' ? 'logarithmic' : 'linear',
        display: mode !== 'kl',
        position: 'right',
        title: { display: true, text: 'Total Medals' },
        min: 1,
        ticks: {
          callback: (value) => Number(value).toLocaleString('en-US'),
        },
      },
    },
  };

  if (mode === 'kl') {
    options.scales = {
      x: options.scales.x,
      y: {
        type: 'linear',
        title: { display: true, text: 'Knight Level' },
      },
    };
  }

  if (mode === 'medals') {
    options.scales = {
      x: options.scales.x,
      y: {
        type: 'logarithmic',
        title: { display: true, text: 'Total Medals' },
        min: Math.max(1, Math.min(...medals.map((v) => Math.max(1, v)))),
        ticks: {
          callback: (value) => Number(value).toLocaleString('en-US'),
        },
      },
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
      Number(row.total_medals),
      Number(row.sr_mpm),
      Number(row.estimated_sr_pct).toFixed(2),
      Number(row.estimated_double_sr_pct).toFixed(2),
      new Date(row.created_at).toISOString(),
    ];
    lines.push(values.map((value) => JSON.stringify(value)).join(','));
  }
  return Buffer.from(lines.join('\n'), 'utf8');
}

module.exports = {
  parseCompactNumber,
  clamp,
  formatNumber,
  formatAge,
  formatEntry,
  parseEntryType,
  calculateSrPercent,
  computePercentile,
  buildChartBuffer,
  buildProgressCsv,
};
