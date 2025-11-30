import { Bot } from '../lib/bot.js';
import { getConfig } from '../lib/config.js';
import { log, sleep, isSocketHangupError } from '../lib/utils.js';

const COOLDOWN = 3600; // 1 hour in seconds

export async function botCommand(options) {
  const config = getConfig();
  const bot = new Bot(config, { dryRun: options.dryRun });
  let currentBookedDate = options.current;
  const targetDate = options.target;
  const minDate = options.min;

  log(`Initializing with current date ${currentBookedDate}`);

  if (options.dryRun) {
    log(`[DRY RUN MODE] Bot will only log what would be booked without actually booking`);
  }

  if (targetDate) {
    log(`Target date: ${targetDate}`);
  }

  if (minDate) {
    log(`Minimum date: ${minDate}`);
  }

  log(`Minimum reschedule improvement: ${config.rescheduleMinImprovementDays} days`);

  const initialThreshold = bot.calculateThresholdDate(currentBookedDate, config.rescheduleMinImprovementDays);
  log(`Only considering dates before ${initialThreshold}`);

  try {
    const sessionHeaders = await bot.initialize();

    while (true) {
      const result = await bot.checkAvailableDate(
        sessionHeaders,
        currentBookedDate,
        minDate
      );

      if (result.date) {
        const booked = await bot.bookAppointment(sessionHeaders, result.date);

        if (booked) {
          // Update current date to the new available date
          currentBookedDate = result.date;

          options = {
            ...options,
            current: currentBookedDate
          };

          if (targetDate && result.date <= targetDate) {
            log(`Target date reached! Successfully booked appointment on ${result.date}`);
            process.exit(0);
          }
        }
      }

      // Determine sleep duration based on availability
      if (result.shouldLongSleep) {
        log(`No dates available from API. Sleeping for ${COOLDOWN} seconds...`);
        await sleep(COOLDOWN);
      } else {
        await sleep(config.refreshDelay);
      }
    }
  } catch (err) {
    if (isSocketHangupError(err)) {
      log(`Socket hangup error: ${err.message}. Trying again after ${COOLDOWN} seconds...`);
      await sleep(COOLDOWN);
    } else {
      log(`Session/authentication error: ${err.message}. Retrying immediately...`);
    }
    return botCommand(options);
  }
}
