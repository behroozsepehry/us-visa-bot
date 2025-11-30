import fetch from "node-fetch";
import cheerio from 'cheerio';
import { log, normalizeDate } from './utils.js';
import { getBaseUri } from './config.js';

// Common headers
const COMMON_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Cache-Control': 'no-store'
};

export class VisaHttpClient {
  constructor(countryCode, email, password) {
    this.baseUri = getBaseUri(countryCode);
    this.email = email;
    this.password = password;
  }

  // Public API methods
  async login() {
    const loginUrl = `${this.baseUri}/users/sign_in`;
    log(`Logging in to ${loginUrl}`);

    const anonymousHeaders = await this._anonymousRequest(loginUrl)
      .then(response => this._extractHeaders(response));

    const loginData = {
      'utf8': '✓',
      'user[email]': this.email,
      'user[password]': this.password,
      'policy_confirmed': '1',
      'commit': 'Sign In'
    };

    log(`Submitting login form for ${this.email}`);
    return this._submitForm(loginUrl, anonymousHeaders, loginData)
      .then(res => {
        log(`Login response received with status: ${res.status}`);
        return {
          ...anonymousHeaders,
          'Cookie': this._extractRelevantCookies(res)
        };
      });
  }

  async checkAvailableDate(headers, scheduleId, facilityId) {
    const url = `${this.baseUri}/schedule/${scheduleId}/appointment/days/${facilityId}.json?appointments[expedite]=false`;
    log(`Checking available dates at: ${url}`);

    return this._jsonRequest(url, headers)
      .then(data => data.map(item => normalizeDate(item.date)));
  }

  async checkAvailableTime(headers, scheduleId, facilityId, date) {
    const url = `${this.baseUri}/schedule/${scheduleId}/appointment/times/${facilityId}.json?date=${date}&appointments[expedite]=false`;
    
    return this._jsonRequest(url, headers)
      .then(data => data['business_times'][0] || data['available_times'][0]);
  }

  async book(headers, scheduleId, facilityId, date, time) {
    const url = `${this.baseUri}/schedule/${scheduleId}/appointment`;

    const bookingHeaders = await this._anonymousRequest(url, headers)
      .then(response => this._extractHeaders(response));

    const bookingData = {
      'utf8': '✓',
      'authenticity_token': bookingHeaders['X-CSRF-Token'],
      'confirmed_limit_message': '1',
      'use_consulate_appointment_capacity': 'true',
      'appointments[consulate_appointment][facility_id]': facilityId,
      'appointments[consulate_appointment][date]': date,
      'appointments[consulate_appointment][time]': time,
      'appointments[asc_appointment][facility_id]': '',
      'appointments[asc_appointment][date]': '',
      'appointments[asc_appointment][time]': ''
    };

    return this._submitFormWithRedirect(url, bookingHeaders, bookingData);
  }

  // Private request methods
  async _anonymousRequest(url, headers = {}) {
    return fetch(url, {
      headers: {
        "User-Agent": "",
        "Accept": "*/*",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        ...headers
      }
    });
  }

  async _jsonRequest(url, headers = {}) {
    log(`Making JSON request with cookie: ${headers.Cookie ? headers.Cookie.substring(0, 50) + '...' : 'NO COOKIE'}`);

    const response = await fetch(url, {
      headers: {
        ...headers,
        "Accept": "application/json",
        "X-Requested-With": "XMLHttpRequest"
      },
      cache: "no-store"
    });

    log(`JSON request to ${url} returned status: ${response.status}`);

    const text = await response.text();

    try {
      const json = JSON.parse(text);
      return this._handleErrors(json);
    } catch (error) {
      log(`Error parsing JSON response from ${url}`);
      log(`Response status: ${response.status} ${response.statusText}`);
      log(`Response content (first 500 chars): ${text.substring(0, 500)}`);
      throw new Error(`Invalid JSON response: ${error.message}`);
    }
  }

  async _submitForm(url, headers = {}, formData = {}) {
    return fetch(url, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
      },
      body: new URLSearchParams(formData)
    });
  }

  async _submitFormWithRedirect(url, headers = {}, formData = {}) {
    return fetch(url, {
      method: "POST",
      redirect: "follow",
      headers: {
        ...headers,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams(formData)
    });
  }

  // Private utility methods
  async _extractHeaders(res) {
    const cookies = this._extractRelevantCookies(res);
    const html = await res.text();
    const $ = cheerio.load(html);
    const csrfToken = $('meta[name="csrf-token"]').attr('content');

    return {
      ...COMMON_HEADERS,
      "Cookie": cookies,
      "X-CSRF-Token": csrfToken,
      "Referer": this.baseUri,
      "Referrer-Policy": "strict-origin-when-cross-origin"
    };
  }

  _extractRelevantCookies(res) {
    const parsedCookies = this._parseCookies(res.headers.get('set-cookie'));

    if (!parsedCookies['_yatri_session']) {
      log('Error: No session cookie (_yatri_session) received from login response');
      log(`Response status: ${res.status} ${res.statusText}`);
      log(`Cookies received: ${JSON.stringify(Object.keys(parsedCookies))}`);
      throw new Error('Login failed: No session cookie received. Please check your credentials and ensure the website is accessible.');
    }

    return `_yatri_session=${parsedCookies['_yatri_session']}`;
  }

  _parseCookies(cookies) {
    const parsedCookies = {};

    if (!cookies) {
      log('Warning: No cookies received from response');
      return parsedCookies;
    }

    cookies.split(';').map(c => c.trim()).forEach(c => {
      const [name, value] = c.split('=', 2);
      parsedCookies[name] = value;
    });

    return parsedCookies;
  }

  _handleErrors(response) {
    const errorMessage = response['error'];

    if (errorMessage) {
      throw new Error(errorMessage);
    }

    return response;
  }
}
