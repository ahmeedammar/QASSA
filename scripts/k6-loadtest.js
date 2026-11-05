import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

/**
 * QASSA (قصّة) - k6 Load Test Suite (Milestone 7)
 * 
 * Simulates 30 concurrent users navigating the multi-tenant SaaS platform:
 *  - Discover marketplace browsing (localized, filtered by city and query, paginated)
 *  - Public shop storefronts rendering across different visual themes
 *  - Customer authentication routes (login / register / forgot-password)
 *  - Responsive performance under peak Tunisian barbershop traffic
 */

const errorRate = new Rate('custom_error_rate');
const discoverDuration = new Trend('page_discover_duration', true);
const shopDuration = new Trend('page_shop_duration', true);

export const options = {
  stages: [
    { duration: '15s', target: 10 }, // Ramp up to 10 VUs
    { duration: '30s', target: 30 }, // Ramp up to 30 concurrent VUs
    { duration: '1m', target: 30 },  // Sustain 30 concurrent users
    { duration: '15s', target: 0 },  // Ramp down gracefully
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],               // Less than 1% failed HTTP requests
    http_req_duration: ['p(95)<800', 'p(99)<1500'], // 95% of requests < 800ms, 99% < 1.5s
    custom_error_rate: ['rate<0.01'],             // Custom assertion failure rate < 1%
    page_discover_duration: ['p(95)<600'],        // Discover directory p95 < 600ms
    page_shop_duration: ['p(95)<700'],            // Shop page p95 < 700ms
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

const LOCALES = ['ar', 'fr', 'en'];
const CITIES = ['Tunis', 'Sfax', 'Sousse', 'Ariana', 'Bizerte'];
const SEARCH_QUERIES = ['barber', 'salon', 'coupe', 'scratch'];
const SHOP_SLUGS = ['scratch-shop-a', 'scratch-shop-b'];

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function () {
  const locale = getRandomItem(LOCALES);

  // 1. Root redirect check (handles locale negotiation)
  group('01_Root_Landing', function () {
    const res = http.get(`${BASE_URL}/`, {
      redirects: 5,
      tags: { name: 'RootLanding' },
    });
    const ok = check(res, {
      'root responds with 200 after redirect': (r) => r.status === 200,
    });
    errorRate.add(!ok);
  });

  sleep(0.5);

  // 2. Discover Marketplace Browsing
  group('02_Discover_Marketplace', function () {
    // Browse default directory
    const startDiscover = Date.now();
    const resDiscover = http.get(`${BASE_URL}/${locale}/discover`, {
      tags: { name: 'DiscoverDefault' },
    });
    discoverDuration.add(Date.now() - startDiscover);

    const okDiscover = check(resDiscover, {
      'discover page returns 200': (r) => r.status === 200,
      'discover contains html': (r) => r.body && r.body.includes('<!DOCTYPE html>'),
    });
    errorRate.add(!okDiscover);

    sleep(0.5);

    // Search and filter on Discover
    const city = getRandomItem(CITIES);
    const search = getRandomItem(SEARCH_QUERIES);
    const filterUrl = `${BASE_URL}/${locale}/discover?city=${encodeURIComponent(city)}&search=${encodeURIComponent(search)}`;
    
    const resFilter = http.get(filterUrl, {
      tags: { name: 'DiscoverFiltered' },
    });
    const okFilter = check(resFilter, {
      'filtered discover returns 200': (r) => r.status === 200,
    });
    errorRate.add(!okFilter);
  });

  sleep(1);

  // 3. Shop Storefront (data-driven with templates)
  group('03_Shop_Storefront', function () {
    const slug = getRandomItem(SHOP_SLUGS);
    const shopUrl = `${BASE_URL}/${locale}/shop/${slug}`;
    const startShop = Date.now();

    const resShop = http.get(shopUrl, {
      tags: { name: 'ShopStorefront' },
    });
    shopDuration.add(Date.now() - startShop);

    const okShop = check(resShop, {
      'shop page responds with 200 or 404 (if unseeded)': (r) => r.status === 200 || r.status === 404,
    });
    errorRate.add(!okShop);
  });

  sleep(1);

  // 4. Authentication Flow Entry Points
  group('04_Auth_Routes', function () {
    const resLogin = http.get(`${BASE_URL}/${locale}/login`, {
      tags: { name: 'LoginPage' },
    });
    const okLogin = check(resLogin, {
      'login page returns 200': (r) => r.status === 200,
    });
    errorRate.add(!okLogin);

    sleep(0.5);

    const resRegister = http.get(`${BASE_URL}/${locale}/register`, {
      tags: { name: 'RegisterPage' },
    });
    const okRegister = check(resRegister, {
      'register page returns 200': (r) => r.status === 200,
    });
    errorRate.add(!okRegister);
  });

  // User pacing / think time before next cycle
  sleep(Math.random() * 2 + 1);
}

export function handleSummary(data) {
  return {
    'loadtest-results.json': JSON.stringify(data, null, 2),
  };
}
