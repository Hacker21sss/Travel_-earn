const moment = require('moment-timezone');

/**
 * Timezone service for handling date/time conversions
 */
class TimezoneService {
  /**
   * Parse date and time with proper timezone handling
   * @param {string} dateString - Date in YYYY-MM-DD format
   * @param {string} timeString - Time in hh:mm AM/PM format
   * @param {string} userTimezone - User's timezone (e.g., 'Asia/Kolkata')
   * @returns {string} ISO string in UTC
   */
  static parseDateTimeWithTimezone(dateString, timeString, userTimezone = 'Asia/Kolkata') {
    try {
      // Validate date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(dateString)) {
        throw new Error(`Invalid date format: ${dateString}. Expected YYYY-MM-DD`);
      }

      // Validate time format
      const timeRegex = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i;
      const timeMatch = timeString.match(timeRegex);
      if (!timeMatch) {
        throw new Error(`Invalid time format: ${timeString}. Expected hh:mm AM/PM`);
      }

      const [, hours, minutes, period] = timeMatch;
      let hour = parseInt(hours);
      const minute = parseInt(minutes);
      const isPM = period.toUpperCase() === 'PM';

      // Validate time components
      if (hour < 1 || hour > 12 || minute < 0 || minute > 59) {
        throw new Error(`Invalid time values: ${timeString}`);
      }

      // Convert 12-hour format to 24-hour format
      if (isPM && hour !== 12) hour += 12;
      if (!isPM && hour === 12) hour = 0;

      // Create moment object in user's timezone
      const dateTimeString = `${dateString} ${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      const localDateTime = moment.tz(dateTimeString, userTimezone);
      
      if (!localDateTime.isValid()) {
        throw new Error(`Invalid date/time combination: ${dateString} ${timeString}`);
      }

      // Convert to UTC and return ISO string
      const utcDateTime = localDateTime.utc();
      
      console.log("Timezone conversion:", {
        input: { dateString, timeString, userTimezone },
        localDateTime: localDateTime.format(),
        utcDateTime: utcDateTime.format(),
        utcISO: utcDateTime.toISOString()
      });

      return utcDateTime.toISOString();
    } catch (error) {
      console.error("Date/time parsing error:", error.message);
      throw error;
    }
  }

  /**
   * Validate and normalize date with timezone handling
   * @param {string} dateString - Date string
   * @param {string} userTimezone - User's timezone
   * @returns {Object} Normalized date object
   */
  static validateAndNormalizeDate(dateString, userTimezone = 'Asia/Kolkata') {
    try {
      let dateObj;
      
      if (dateString.includes('T')) {
        // ISO string format - parse as UTC and convert to user timezone
        dateObj = moment.utc(dateString).tz(userTimezone);
      } else {
        // Simple date format - create in user's timezone
        dateObj = moment.tz(dateString, userTimezone);
      }
      
      if (!dateObj.isValid()) {
        throw new Error(`Invalid date format: ${dateString}`);
      }
      
      // Get start of day in user's timezone
      const startOfDay = dateObj.startOf('day');
      
      return {
        date: startOfDay.format('YYYY-MM-DD'),
        dateObj: startOfDay.toDate(),
        utcISO: startOfDay.utc().toISOString()
      };
    } catch (error) {
      console.error("Date validation error:", error.message);
      throw error;
    }
  }

  /**
   * Convert UTC ISO string to user's local timezone
   * @param {string} utcISOString - UTC ISO string
   * @param {string} userTimezone - User's timezone
   * @returns {Object} Local date/time information
   */
  static convertUTCToLocal(utcISOString, userTimezone = 'Asia/Kolkata') {
    try {
      const utcMoment = moment.utc(utcISOString);
      const localMoment = utcMoment.tz(userTimezone);
      
      return {
        date: localMoment.format('YYYY-MM-DD'),
        time: localMoment.format('hh:mm A'),
        dateTime: localMoment.format('YYYY-MM-DD HH:mm:ss'),
        utcISO: utcISOString,
        userTimezone
      };
    } catch (error) {
      console.error("UTC to local conversion error:", error.message);
      throw error;
    }
  }

  /**
   * Get current date/time in user's timezone
   * @param {string} userTimezone - User's timezone
   * @returns {Object} Current date/time information
   */
  static getCurrentDateTimeInTimezone(userTimezone = 'Asia/Kolkata') {
    const now = moment().tz(userTimezone);
    
    return {
      date: now.format('YYYY-MM-DD'),
      time: now.format('hh:mm A'),
      dateTime: now.format('YYYY-MM-DD HH:mm:ss'),
      utcISO: now.utc().toISOString(),
      userTimezone
    };
  }

  /**
   * Check if a date is in the past relative to user's timezone
   * @param {string} dateString - Date string
   * @param {string} userTimezone - User's timezone
   * @returns {boolean} True if date is in the past
   */
  static isDateInPast(dateString, userTimezone = 'Asia/Kolkata') {
    try {
      const dateObj = moment.tz(dateString, userTimezone);
      const currentDate = moment().tz(userTimezone).startOf('day');
      
      return dateObj.isBefore(currentDate);
    } catch (error) {
      console.error("Date comparison error:", error.message);
      return false;
    }
  }

  /**
   * Get timezone offset in minutes for a given timezone
   * @param {string} timezone - Timezone identifier
   * @returns {number} Offset in minutes
   */
  static getTimezoneOffset(timezone = 'Asia/Kolkata') {
    try {
      const now = moment().tz(timezone);
      return now.utcOffset();
    } catch (error) {
      console.error("Timezone offset error:", error.message);
      return 0;
    }
  }

  /**
   * Validate timezone identifier
   * @param {string} timezone - Timezone identifier
   * @returns {boolean} True if valid timezone
   */
  static isValidTimezone(timezone) {
    return moment.tz.zone(timezone) !== null;
  }

  /**
   * Get list of common timezones
   * @returns {Array} Array of timezone objects
   */
  static getCommonTimezones() {
    return [
      { value: 'Asia/Kolkata', label: 'India (IST)', offset: '+05:30' },
      { value: 'Asia/Dubai', label: 'UAE (GST)', offset: '+04:00' },
      { value: 'America/New_York', label: 'Eastern Time (ET)', offset: '-05:00' },
      { value: 'America/Los_Angeles', label: 'Pacific Time (PT)', offset: '-08:00' },
      { value: 'Europe/London', label: 'London (GMT)', offset: '+00:00' },
      { value: 'Europe/Paris', label: 'Paris (CET)', offset: '+01:00' },
      { value: 'Asia/Tokyo', label: 'Tokyo (JST)', offset: '+09:00' },
      { value: 'Australia/Sydney', label: 'Sydney (AEST)', offset: '+10:00' }
    ];
  }
}

module.exports = TimezoneService;
