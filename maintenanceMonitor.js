const DEFAULT_CHECK_INTERVAL_SECONDS = 300; // 5 minutes
const SERVER_STATUS_BASEURL = process.env.SERVER_STATUS_BASEURL ?? 'https://slime-checkinfo.s3.us-east-1.amazonaws.com';
const SERVER_STATUS_URL = `${SERVER_STATUS_BASEURL}/ef2_live.json`;

function parseChannelIds(value) {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseCheckIntervalSeconds(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_CHECK_INTERVAL_SECONDS;
  }

  return parsed;
}

function getMaintenanceState(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  if (payload.check === 'Y') {
    return 'maintenance';
  }

  if (payload.check === 'N') {
    return 'operational';
  }

  return null;
}

function createMaintenanceMonitor({
  client,
  channelIds = [],
  fetcher = async () => {
    const response = await fetch(SERVER_STATUS_URL);
    if (!response.ok) {
      throw new Error(`Maintenance check request failed with status ${response.status}`);
    }

    return response.json();
  },
  intervalSeconds = parseCheckIntervalSeconds(process.env.MAINTENANCE_CHECK_INTERVAL_SECONDS),
  logger = console,
  onStateChange = null,
} = {}) {
  let currentState = null;
  let timer = null;

  async function notifyChannels(message) {
    if (!channelIds.length) {
      return;
    }

    const uniqueChannelIds = [...new Set(channelIds)];
    for (const channelId of uniqueChannelIds) {
      try {
        const channel = await client.channels.fetch(channelId);
        if (channel && typeof channel.send === 'function') {
          await channel.send(message);
        }
      } catch (error) {
        logger.error(`Failed to post maintenance update to channel ${channelId}:`, error);
      }
    }
  }

  async function checkNow() {
    try {
      const payload = await fetcher();
      const nextState = getMaintenanceState(payload);

      if (nextState === null) {
        logger.warn('Maintenance check returned an unexpected payload:', payload);
        return null;
      }

      if (currentState === null) {
        currentState = nextState;
        return currentState;
      }

      if (nextState === currentState) {
        return currentState;
      }

      const previousState = currentState;
      currentState = nextState;

      const message = nextState === 'maintenance'
        ? '⚠️ The EF2 server is now under maintenance.'
        : '✅ The EF2 server is no longer under maintenance.';

      await notifyChannels(message);

      if (typeof onStateChange === 'function') {
        onStateChange(nextState, message, previousState);
      }

      return currentState;
    } catch (error) {
      logger.error('Failed to check maintenance status:', error);
      return null;
    }
  }

  function start(intervalMs = intervalSeconds * 1000) {
    if (timer) {
      return timer;
    }

    timer = setInterval(() => {
      checkNow().catch((error) => {
        logger.error('Maintenance monitor interval failed:', error);
      });
    }, intervalMs);

    return timer;
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  return {
    checkNow,
    start,
    stop,
  };
}

module.exports = {
  createMaintenanceMonitor,
  getMaintenanceState,
  parseChannelIds,
  parseCheckIntervalSeconds,
};
