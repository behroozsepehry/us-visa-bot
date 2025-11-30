import dotenv from 'dotenv';

dotenv.config();

export function getConfig() {
  const config = {
    email: process.env.EMAIL,
    password: process.env.PASSWORD,
    scheduleId: process.env.SCHEDULE_ID,
    facilityId: process.env.FACILITY_ID,
    countryCode: process.env.COUNTRY_CODE,
    refreshDelay: Number(process.env.REFRESH_DELAY || 3),
    rescheduleMinImprovementDays: Number(process.env.RESCHEDULE_MIN_IMPROVEMENT_DAYS)
  };

  validateConfig(config);
  return config;
}

function validateConfig(config) {
  const required = ['email', 'password', 'scheduleId', 'facilityId', 'countryCode', 'rescheduleMinImprovementDays'];
  // Use explicit undefined/null/empty check instead of falsy check (so 0 is valid)
  const missing = required.filter(key => config[key] === undefined || config[key] === null || config[key] === '');

  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.map(k => k.toUpperCase()).join(', ')}`);
    process.exit(1);
  }

  // Validate rescheduleMinImprovementDays is a non-negative number
  if (isNaN(config.rescheduleMinImprovementDays) || config.rescheduleMinImprovementDays < 0) {
    console.error(`RESCHEDULE_MIN_IMPROVEMENT_DAYS must be a non-negative number, got: ${process.env.RESCHEDULE_MIN_IMPROVEMENT_DAYS}`);
    process.exit(1);
  }
}

export function getBaseUri(countryCode) {
  return `https://ais.usvisa-info.com/en-${countryCode}/niv`;
}
