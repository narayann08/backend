'use strict';

/** India Standard Time is a fixed UTC+5:30 offset — no DST to account for. */
const IST_OFFSET_MINUTES = 5 * 60 + 30;

/**
 * Hour-of-day (0-23) in India Standard Time for a given instant.
 *
 * Every plant in this system is located in India, so mock generation curves
 * must use IST to decide day/night — `date.getUTCHours()` is off by 5.5 hours
 * and will place solar "daylight" in the middle of the Indian night.
 * @param {Date} date
 * @returns {number}
 */
function istHourOfDay(date) {
  const istMs = date.getTime() + IST_OFFSET_MINUTES * 60 * 1000;
  return new Date(istMs).getUTCHours();
}

module.exports = { istHourOfDay, IST_OFFSET_MINUTES };
