import { VisaHttpClient } from './client.js';
import { log } from './utils.js';

export class Bot {
  constructor(config, options = {}) {
    this.config = config;
    this.dryRun = options.dryRun || false;
    this.rescheduleMinImprovementDays = config.rescheduleMinImprovementDays;
    this.client = new VisaHttpClient(this.config.countryCode, this.config.email, this.config.password);
  }

  async initialize() {
    log('Initializing visa bot...');
    return await this.client.login();
  }

  /**
   * Calculate the threshold date: X days before the current booked date
   * @param {string} dateStr - Date in YYYY-MM-DD format
   * @param {number} days - Number of days to subtract
   * @returns {string} New date in YYYY-MM-DD format
   */
  calculateThresholdDate(dateStr, days) {
    const date = new Date(dateStr);
    date.setDate(date.getDate() - days);

    // Format as YYYY-MM-DD
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  async checkAvailableDate(sessionHeaders, currentBookedDate, minDate) {
    const dates = await this.client.checkAvailableDate(
      sessionHeaders,
      this.config.scheduleId,
      this.config.facilityId
    );

    if (!dates || dates.length === 0) {
      return { date: null, shouldLongSleep: true };
    }

    dates.sort();
    log(`earliest available date: ${dates[0]}`);

    // Calculate the threshold date (earliest date we'll accept)
    const thresholdDate = this.calculateThresholdDate(
      currentBookedDate,
      this.rescheduleMinImprovementDays
    );

    // Filter dates that meet the minimum improvement threshold and are after minimum date
    const goodDates = dates.filter(date => {
      // Must be at least X days earlier than current booking
      if (date >= thresholdDate) {
        return false;
      }

      // Must be after the minimum date constraint (if specified)
      if (minDate && date < minDate) {
        return false;
      }

      return true;
    });

    if (goodDates.length === 0) {
      log(`no good dates found after filtering (seeking dates before ${thresholdDate}, which is ${this.rescheduleMinImprovementDays} days before current booking ${currentBookedDate})`);
      return { date: null, shouldLongSleep: false };
    }

    const earliestDate = goodDates[0];

    log(`found ${goodDates.length} good dates: ${goodDates.join(', ')}, using earliest: ${earliestDate}`);
    return { date: earliestDate, shouldLongSleep: false };
  }

  async bookAppointment(sessionHeaders, date) {
    const time = await this.client.checkAvailableTime(
      sessionHeaders,
      this.config.scheduleId,
      this.config.facilityId,
      date
    );

    if (!time) {
      log(`no available time slots for date ${date}`);
      return false;
    }

    if (this.dryRun) {
      log(`[DRY RUN] Would book appointment at ${date} ${time} (not actually booking)`);
      return true;
    }

    await this.client.book(
      sessionHeaders,
      this.config.scheduleId,
      this.config.facilityId,
      date,
      time
    );

    log(`booked time at ${date} ${time}`);
    return true;
  }

}
