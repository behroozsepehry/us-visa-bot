import { Bot } from '../lib/bot.js';
import { getConfig } from '../lib/config.js';
import { log, sleep, isSocketHangupError, normalizeDate, calculateFailureBackoffDelay, setVerboseMode } from '../lib/utils.js';

export async function botCommand(options) {
  const config = getConfig();

  // Initialize verbose mode
  setVerboseMode(options.verbose || false);

  const bot = new Bot(config, { dryRun: options.dryRun });

  // Initialize consecutive failure counter
  if (options.consecutiveFailures === undefined) {
    options.consecutiveFailures = 0;
  }

  // Normalize all date inputs to YYYY-MM-DD format
  let currentBookedDate = normalizeDate(options.current);
  const targetDate = options.target ? normalizeDate(options.target) : undefined;
  const minDate = options.min ? normalizeDate(options.min) : undefined;

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

  try {
    const sessionHeaders = await bot.initialize();

    while (true) {
      const result = await bot.checkAvailableDate(
        sessionHeaders,
        currentBookedDate,
        minDate
      );

      // Reset failure counter on successful API response (whether we get a suitable date or not)
      if (!result.shouldLongSleep) {
        options.consecutiveFailures = 0;
      }

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
        options.consecutiveFailures++;
        const delay = calculateFailureBackoffDelay(
          options.consecutiveFailures,
          config.refreshDelay,
          config.failureBackoffMultiplier,
          config.failureBackoffMaxDelay
        );
        log(`No dates available from API (failure #${options.consecutiveFailures}). Sleeping for ${delay} seconds (exponential backoff)...`);
        await sleep(delay);
      } else {
        await sleep(config.refreshDelay);
      }
    }
  } catch (err) {
    if (isSocketHangupError(err)) {
      options.consecutiveFailures++;
      const delay = calculateFailureBackoffDelay(
        options.consecutiveFailures,
        config.refreshDelay,
        config.failureBackoffMultiplier,
        config.failureBackoffMaxDelay
      );
      log(`Socket hangup error: ${err.message} (failure #${options.consecutiveFailures}). Trying again after ${delay} seconds (exponential backoff)...`);
      await sleep(delay);
    } else {
      log(`Session/authentication error: ${err.message}. Retrying immediately...`);
    }
    return botCommand(options);
  }
}
