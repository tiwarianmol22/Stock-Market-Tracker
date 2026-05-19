/**
 * Simple IST-timestamped console logger for APT backend.
 */

const IST_OPTIONS = {
  timeZone: 'Asia/Kolkata',
  hour12: false,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
};

/**
 * Returns current time formatted in IST.
 * @returns {string}
 */
function getISTTime() {
  return new Date().toLocaleTimeString('en-IN', IST_OPTIONS);
}

/**
 * Log an info message.
 * @param {string} tag - Module label e.g. '[DB]'
 * @param {string} message
 */
function info(tag, message) {
  console.log(`\x1b[36m[${getISTTime()} IST]\x1b[0m \x1b[32m${tag}\x1b[0m ${message}`);
}

/**
 * Log an error message.
 * @param {string} tag
 * @param {string} message
 * @param {Error} [err]
 */
function error(tag, message, err) {
  console.error(`\x1b[36m[${getISTTime()} IST]\x1b[0m \x1b[31m${tag}\x1b[0m ${message}`, err || '');
}

/**
 * Log a warning message.
 * @param {string} tag
 * @param {string} message
 */
function warn(tag, message) {
  console.warn(`\x1b[36m[${getISTTime()} IST]\x1b[0m \x1b[33m${tag}\x1b[0m ${message}`);
}

module.exports = { info, error, warn };
