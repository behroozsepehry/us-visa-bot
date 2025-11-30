export function sleep(seconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, seconds * 1000);
  });
}

export function log(message) {
  console.log(`[${new Date().toLocaleString()}]`, message);
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

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}