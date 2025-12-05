export function sleep(seconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, seconds * 1000);
  });
}

/**
 * Format a log message with timestamp prefix
 * @param {string} message - The message to format
 * @returns {string} Formatted message with timestamp
 */
function formatLogMessage(message) {
  return `[${new Date().toLocaleString()}] ${message}`;
}

export function log(message) {
  console.log(formatLogMessage(message));
}

/**
 * Module-level state for verbose logging mode.
 * Set via setVerboseMode() at application startup.
 */
let isVerboseMode = false;

/**
 * Enable or disable verbose logging mode globally.
 * @param {boolean} verbose - Whether to enable verbose logging
 */
export function setVerboseMode(verbose) {
  isVerboseMode = Boolean(verbose);
}

/**
 * Log a message only when verbose mode is enabled.
 * @param {string} message - The message to log
 */
export function verboseLog(message) {
  if (isVerboseMode) {
    console.log(formatLogMessage(message));
  }
}

export function isSocketHangupError(err) {
  return err.code === 'ECONNRESET' ||
         err.code === 'ENOTFOUND' ||
         err.code === 'ETIMEDOUT' ||
         err.message.includes('socket hang up') ||
         err.message.includes('network') ||
         err.message.includes('connection');
}

/**
 * Format a Date object to YYYY-MM-DD string using UTC timezone
 * @param {Date} date - Date object to format
 * @returns {string} Date in YYYY-MM-DD format
 */
function formatDateUTC(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Normalize a date string to YYYY-MM-DD format
 * @param {string} dateStr - Date string in any format parseable by Date constructor
 * @returns {string} Date in YYYY-MM-DD format
 * @throws {Error} If date string is invalid
 */
export function normalizeDate(dateStr) {
  const date = new Date(dateStr);

  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date format: "${dateStr}". Please use YYYY-MM-DD format.`);
  }

  return formatDateUTC(date);
}

/**
 * Calculate a date X days before the given date
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @param {number} days - Number of days to subtract
 * @returns {string} New date in YYYY-MM-DD format
 */
export function calculateThresholdDate(dateStr, days) {
  const date = new Date(dateStr);
  date.setUTCDate(date.getUTCDate() - days);
  return formatDateUTC(date);
}

/**
 * Calculate exponential failure backoff delay
 * @param {number} consecutiveFailures - Number of consecutive failures
 * @param {number} baseDelay - Base delay in seconds (REFRESH_DELAY)
 * @param {number} multiplier - Exponential multiplier
 * @param {number} maxDelay - Maximum delay cap in seconds
 * @returns {number} Delay in seconds
 */
export function calculateFailureBackoffDelay(consecutiveFailures, baseDelay, multiplier, maxDelay) {
  // Calculate exponential delay: baseDelay * multiplier^failures
  const delay = baseDelay * Math.pow(multiplier, consecutiveFailures);

  // Handle Infinity or NaN from overflow
  if (!isFinite(delay)) {
    return maxDelay;
  }

  // Apply maximum cap
  return Math.min(Math.round(delay), maxDelay);
}
