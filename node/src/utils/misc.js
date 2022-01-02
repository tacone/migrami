/**
 * for each time this function gets called it will countdown from maxAttempts to 0
 * if the time between two calls is more than maxInterval, it will start afresh
 *
 * @param {int} maxAttempts maximum number of attempts
 * @param {int} maxInterval maximum ms between attempts to avoid resetting the attempts counter
 * @returns {function} a function that returns the number of attempts left or sets it to maxAttempts if true is passed as its first argument
 */

export function maxAttemptsChecker(maxAttempts, maxInterval) {
  let attempts, lastStepTime;

  const resetState = () => {
    attempts = 0;
    lastStepTime = 0;
  };

  resetState();

  return function attemptsChecker(reset = false) {
    if (reset) {
      resetState();
      return;
    }

    if (lastStepTime && lastStepTime + maxInterval < Date.now()) {
      resetState();
    }

    attempts++;
    if (attempts >= maxAttempts && lastStepTime + maxInterval < Date.now()) {
      resetState();
      return 0;
    }

    lastStepTime = Date.now();

    return Math.max(0, maxAttempts - attempts);
  };
}

export function convertBase(value, from_base, to_base) {
  value = value.toString();
  var range = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+/'.split('');
  var from_range = range.slice(0, from_base);
  var to_range = range.slice(0, to_base);

  var dec_value = value.split('').reverse().reduce(function (carry, digit, index) {
    if (from_range.indexOf(digit) === -1) throw new Error('Invalid digit `'+digit+'` for base '+from_base+'.');
    return carry += from_range.indexOf(digit) * (Math.pow(from_base, index));
  }, 0);

  var new_value = '';
  while (dec_value > 0) {
    new_value = to_range[dec_value % to_base] + new_value;
    dec_value = (dec_value - (dec_value % to_base)) / to_base;
  }
  return new_value || '0';
}

// TODO: make this configurable
export function timestampPacker (timestamp) {
  return convertBase(parseInt(timestamp / 1000), 10, 62);
};