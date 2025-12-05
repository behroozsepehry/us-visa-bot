# US Visa Bot 🤖

An automated bot that monitors and reschedules US visa interview appointments to get you an earlier date.

## Features

- 🔄 Continuously monitors available appointment slots
- 📅 Automatically books earlier dates when found  
- 🎯 Configurable target and minimum date constraints
- 🚨 Exits successfully when target date is reached
- 📊 Detailed logging with timestamps
- 🔐 Secure authentication with environment variables

## How It Works

The bot logs into your account on https://ais.usvisa-info.com/ and checks for available appointment dates every few seconds. When it finds a date earlier than your current booking (and within your specified constraints), it automatically reschedules your appointment.

## Prerequisites

- Node.js 16+ 
- A valid US visa interview appointment
- Access to https://ais.usvisa-info.com/

## Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/us-visa-bot.git
cd us-visa-bot
```

2. Install dependencies:
```bash
npm install
```

## Configuration

Create a `.env` file in the project root with your credentials:

```env
EMAIL=your.email@example.com
PASSWORD=your_password
COUNTRY_CODE=your_country_code
SCHEDULE_ID=your_schedule_id
FACILITY_ID=your_facility_id
REFRESH_DELAY=3
RESCHEDULE_MIN_IMPROVEMENT_DAYS=45
```

### Finding Your Configuration Values

| Variable | Description | How to Find |
|----------|-------------|-------------|
| `EMAIL` | Your login email | Your credentials for ais.usvisa-info.com |
| `PASSWORD` | Your login password | Your credentials for ais.usvisa-info.com |
| `COUNTRY_CODE` | Your country code | Found in URL: `https://ais.usvisa-info.com/en-{COUNTRY_CODE}/` <br>Examples: `br` (Brazil), `fr` (France), `de` (Germany) |
| `SCHEDULE_ID` | Your appointment schedule ID | Found in URL when rescheduling: <br>`https://ais.usvisa-info.com/en-{COUNTRY_CODE}/niv/schedule/{SCHEDULE_ID}/continue_actions` |
| `FACILITY_ID` | Your consulate facility ID | Found in network calls when selecting dates, or inspect the date selector dropdown <br>Example: Paris = `44` |
| `REFRESH_DELAY` | Seconds between checks | Optional, defaults to 3 seconds |
| `RESCHEDULE_MIN_IMPROVEMENT_DAYS` | Minimum days improvement required | **Required**. Minimum number of days a new date must be earlier than your current booking to trigger a reschedule. <br>Example: `45` means only reschedule if new date is 45+ days earlier. <br>Set to `0` to reschedule for any earlier date. |
| `FAILURE_BACKOFF_MULTIPLIER` | Exponential backoff multiplier | **Required**. Growth factor for exponential backoff on consecutive failures. <br>Example: `2` means delays double each failure (30s → 60s → 120s → ...) <br>**Recommended range:** 1.5 to 10 |
| `FAILURE_BACKOFF_MAX_DELAY` | Maximum failure backoff delay | **Required**. Maximum delay cap in seconds. <br>Example: `3600` caps backoff at 1 hour regardless of failure count <br>**Recommended range:** 300 to 7200 (5 minutes to 2 hours) |

## Usage

Run the bot with your current appointment date:

```bash
node index.js -c <current_date> [-t <target_date>] [-m <min_date>]
```

### Command Line Arguments

| Flag | Long Form | Required | Description |
|------|-----------|----------|-------------|
| `-c` | `--current` | ✅ | Your current booked interview date (YYYY-MM-DD) |
| `-t` | `--target` | ❌ | Target date to stop at - exits successfully when reached |
| `-m` | `--min` | ❌ | Minimum acceptable date - skips dates before this |
| `-v` | `--verbose` | ❌ | Enable verbose logging (shows debug details) |
| | `--dry-run` | ❌ | Log what would be booked without actually booking |

### Examples

```bash
# Basic usage - reschedule to any earlier date
node index.js -c 2023-06-15

# With target date - stop when you get June 1st or earlier  
node index.js -c 2023-06-15 -t 2023-06-01

# With minimum date - only accept dates after May 1st
node index.js -c 2023-06-15 -m 2023-05-01

# With both constraints - only book between May 1st and June 1st
node index.js -c 2023-06-15 -t 2023-06-01 -m 2023-05-01

# Enable verbose logging to see detailed debug information
node index.js -c 2023-06-15 --verbose

# Dry-run with verbose logging
node index.js -c 2023-06-15 --dry-run --verbose

# Get help
node index.js --help
```

## How It Behaves

The bot will:
1. **Log in** to your account using provided credentials
2. **Check** for available dates every few seconds
3. **Compare** found dates against your constraints:
   - Must be at least X days earlier than current date (where X = `RESCHEDULE_MIN_IMPROVEMENT_DAYS`)
   - Must be after minimum date (`-m`) if specified
   - Will exit successfully if target date (`-t`) is reached
4. **Book** the appointment automatically if conditions are met
5. **Continue** monitoring until target is reached or manually stopped

## Verbose Mode

Add `--verbose` or `-v` to see detailed debug logs (API URLs, HTTP requests/responses, cookies).

Default mode shows only important events: configuration, bookings, errors, and date checks.

## Reschedule Threshold

The bot requires a minimum improvement threshold to avoid wasting your limited reschedules on marginal gains.

### How it works

- Set `RESCHEDULE_MIN_IMPROVEMENT_DAYS` in your `.env` file
- The bot will ONLY reschedule if the new date is at least this many days earlier
- This applies from the very first reschedule (not just subsequent ones)

### Examples

**Scenario 1: Current booking is Feb 15, threshold is 45 days**
- Jan 1 (45 days earlier) → ❌ Not accepted (need > 45 days)
- Dec 31 (46 days earlier) → ✅ Accepted
- Dec 15 (62 days earlier) → ✅ Accepted

**Scenario 2: Current booking is Mar 20, threshold is 7 days**
- Mar 14 (6 days earlier) → ❌ Not accepted
- Mar 13 (7 days earlier) → ❌ Not accepted (need > 7 days)
- Mar 12 (8 days earlier) → ✅ Accepted

**Scenario 3: Threshold is 0**
- Any date earlier than current booking → ✅ Accepted

### Why use this?

You typically have a limit of 7 reschedules. Using a threshold prevents wasting them on small improvements:
- Without threshold: Could waste reschedules on 1-day improvements
- With 45-day threshold: Only reschedule for significant improvements
- Maximizes your chances of getting the earliest possible date

## Exponential Failure Backoff

The bot implements exponential backoff for handling errors gracefully:

### How It Works

- **Baseline**: Starts with your normal `REFRESH_DELAY` (e.g., 30 seconds)
- **Growth**: Each consecutive failure multiplies the delay by `FAILURE_BACKOFF_MULTIPLIER`
- **Maximum Cap**: Delay never exceeds `FAILURE_BACKOFF_MAX_DELAY`
- **Auto-Reset**: Counter resets to 0 on successful API responses

### When It Applies

Exponential backoff is triggered by:
1. **Network/Socket Errors**: Connection failures (ECONNRESET, ETIMEDOUT, ENOTFOUND)
2. **No Dates Available**: When the API returns an empty date list

### Configuration Example

```env
REFRESH_DELAY=30                    # Normal polling: 30 seconds
FAILURE_BACKOFF_MULTIPLIER=2        # Double delay on each failure
FAILURE_BACKOFF_MAX_DELAY=3600      # Cap at 1 hour maximum
```

**Delay Pattern**: 30s → 60s → 120s → 240s → 480s → 960s → 1920s → 3600s (capped)

### Why This Matters

- **Prevents API abuse**: Automatically backs off during outages or rate limiting
- **Saves resources**: Reduces wasted API calls when dates aren't available
- **Graceful recovery**: Quickly resumes normal operation when system recovers
- **Configurable**: Tune aggressiveness based on your needs

## Output Examples

```
[2023-07-16T10:30:00.000Z] Initializing with current date 2023-08-15
[2023-07-16T10:30:00.000Z] Target date: 2023-07-01
[2023-07-16T10:30:00.000Z] Minimum date: 2023-06-01
[2023-07-16T10:30:01.000Z] Logging in
[2023-07-16T10:30:03.000Z] nearest date is further than already booked (2023-08-15 vs 2023-09-01)
[2023-07-16T10:30:06.000Z] booked time at 2023-07-15 09:00
[2023-07-16T10:30:06.000Z] Target date reached! Successfully booked appointment on 2023-07-15
```

## Safety Features

- ✅ **Read-only until booking** - Only books when better dates are found
- ✅ **Respects constraints** - Won't book outside your specified date range
- ✅ **Graceful exit** - Stops automatically when target is reached
- ✅ **Error recovery** - Automatically retries on network errors
- ✅ **Secure credentials** - Uses environment variables for sensitive data

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the ISC License.

## Disclaimer

This bot is for educational purposes. Use responsibly and in accordance with the terms of service of the visa appointment system. The authors are not responsible for any misuse or consequences.
