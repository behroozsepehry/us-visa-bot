# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**Run the bot:**
```bash
npm start -- -c 2023-06-15 -t 2023-06-01 -m 2023-05-01
npm run dev -- -c <current-date> [--target <date>] [--min <date>] [--dry-run] [--verbose]
```

**Required argument:**
- `-c, --current <date>` - Your currently booked interview date

**Optional arguments:**
- `-t, --target <date>` - Target date to stop at when reached
- `-m, --min <date>` - Minimum acceptable date (won't book earlier than this)
- `--dry-run` - Log what would be booked without actually booking
- `-v, --verbose` - Enable verbose logging for debugging (shows API calls, HTTP details)

**Note:** Testing and linting are not currently configured (placeholders exist in package.json).

## Architecture Overview

This is an automated US visa appointment rescheduling bot that monitors ais.usvisa-info.com and automatically books earlier appointment dates when they become available.

**Component Layers:**
```
CLI (index.js)
  └─> Command Orchestration (commands/bot.js)
      └─> Bot Logic (lib/bot.js)
          └─> HTTP Client (lib/client.js)
              └─> Visa API
```

**Directory Structure:**
- [src/index.js](src/index.js) - CLI entry point using Commander.js
- [src/commands/bot.js](src/commands/bot.js) - Main orchestration loop, state management, failure handling
- [src/lib/bot.js](src/lib/bot.js) - Core appointment logic, date filtering, booking decisions
- [src/lib/client.js](src/lib/client.js) - HTTP client for visa API, authentication, session management
- [src/lib/config.js](src/lib/config.js) - Environment configuration and validation
- [src/lib/utils.js](src/lib/utils.js) - Date utilities, logging, backoff calculations

## Core Workflow

The main execution loop in [commands/bot.js](src/commands/bot.js) continuously:

1. **Check Available Dates** - Fetches available appointment slots from API
2. **Filter Dates** - Applies two filters:
   - Must be ≥ `RESCHEDULE_MIN_IMPROVEMENT_DAYS` earlier than current booking
   - Must be ≥ `--min` date (if specified)
3. **Book Appointment** - If a good date is found:
   - Checks available time slots
   - Books the appointment (or logs in dry-run mode)
   - Updates current booked date
4. **Check Exit Condition** - Exits if booked date ≤ target date
5. **Sleep & Retry** - Sleeps based on failure state (exponential backoff or normal delay)

**Failure Handling:**
- Tracks consecutive failures in `consecutiveFailures` counter
- Applies exponential backoff: `delay = refreshDelay × multiplier^failures` (capped at max)
- Resets counter on **any successful API response** (not just successful bookings)
- Retries with recursion to maintain state across attempts

## Key Components

### VisaHttpClient ([lib/client.js](src/lib/client.js))

Handles all API interactions with the visa appointment system.

**Authentication Flow:**
1. Fetches login page anonymously to extract CSRF token (from HTML meta tag)
2. Submits login with credentials
3. Extracts `_yatri_session` cookie from response
4. Uses cookie + CSRF token in all subsequent requests

**API Methods:**
- `login()` - Authenticates and establishes session
- `checkAvailableDate()` - Returns available appointment dates (JSON)
- `checkAvailableTime(date)` - Returns available time slots for a date
- `book(date, time)` - Books an appointment

**Implementation Details:**
- Uses cheerio to parse HTML and extract CSRF tokens
- Mimics browser behavior with User-Agent headers
- Comprehensive error handling with detailed logging

### Bot Class ([lib/bot.js](src/lib/bot.js))

Core appointment logic and decision-making.

**Key Methods:**
- `initialize()` - Logs into visa system via VisaHttpClient
- `checkAvailableDate(currentDate, minDate)` - Filters available dates by improvement threshold and minimum constraint
- `bookAppointment(date, dryRun)` - Books appointment or dry-runs it

**Date Filtering Logic:**
The threshold date is calculated as: `currentDate - RESCHEDULE_MIN_IMPROVEMENT_DAYS`
- Only dates on or before this threshold pass the filter
- This prevents wasting limited reschedules on marginal improvements

### Configuration ([lib/config.js](src/lib/config.js))

Loads and validates environment variables from `.env`.

**Required Variables:**
- `EMAIL`, `PASSWORD` - Visa account credentials
- `COUNTRY_CODE` - Country code (e.g., `ca`, `br`, `fr`, `de`)
- `SCHEDULE_ID` - Your appointment schedule ID
- `FACILITY_ID` - Your consulate facility ID
- `RESCHEDULE_MIN_IMPROVEMENT_DAYS` - Minimum days improvement to trigger reschedule
- `FAILURE_BACKOFF_MULTIPLIER` - Exponential backoff growth factor
- `FAILURE_BACKOFF_MAX_DELAY` - Maximum backoff delay in seconds

**Optional Variables:**
- `REFRESH_DELAY` - Seconds between API checks (defaults to 3)

**Special Handling:**
- Allows `0` as a valid value for `rescheduleMinImprovementDays`
- Throws clear errors for missing required variables

## Important Patterns

### Exponential Backoff for Resilience

When failures occur (network errors or no dates available), the bot implements exponential backoff:

**Calculation:** `delay = refreshDelay × multiplier^consecutiveFailures` (capped at `FAILURE_BACKOFF_MAX_DELAY`)

**Example progression** (with multiplier=3.5, baseDelay=30s):
- 0 failures: 30s
- 1 failure: 105s
- 2 failures: 367s
- 3 failures: 1285s
- 4+ failures: 3600s (capped)

**Critical:** The failure counter resets on **any successful API response**, not just successful bookings. This allows quick resumption of normal polling after transient issues.

### UTC Date Handling

All dates are normalized to `YYYY-MM-DD` format in UTC using [utils.js:normalizeDate()](src/lib/utils.js).

**Why UTC:**
- Prevents timezone-related bugs when comparing dates
- Ensures consistent behavior regardless of system timezone
- Uses `getUTCFullYear()`, `getUTCMonth()`, `getUTCDate()` throughout

**Key Functions:**
- `normalizeDate(date)` - Converts any date input to YYYY-MM-DD in UTC
- `calculateThresholdDate(date, days)` - Calculates date X days before given date (UTC)

### Dry-Run Mode

When `--dry-run` is specified:
- The bot performs all logic (login, check dates, filter dates)
- Logs what would be booked: `[DRY RUN] Would book: ${date} at ${time}`
- Does NOT make actual booking API call
- Useful for validating configuration and threshold logic before committing to real bookings

### Recursive Retry Pattern

The [botCommand()](src/commands/bot.js) function uses recursion for retries:
- State maintained via `options` object passed recursively
- `consecutiveFailures` counter accumulates across calls
- Allows graceful handling of transient errors without complex loop state
- Each iteration sleeps, then recursively calls itself to continue

### Verbose Logging

The `--verbose` flag shows debug logs (API URLs, cookies, HTTP status). Implementation uses module-level state in [utils.js](src/lib/utils.js) with `verboseLog()` function that checks `isVerboseMode` flag set at startup.
