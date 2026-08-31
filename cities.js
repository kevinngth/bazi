/**
 * BaZiCities — a curated world city table for True Solar Time correction.
 *
 * Each entry supplies the two numbers the BaZi engine needs to correct a
 * birth clock time to apparent solar time:
 *   longitude         degrees East (west is negative)
 *   utcOffsetMinutes  the STANDARD (non-DST) UTC offset, in minutes
 *
 * Scope & accuracy:
 * - ~300 significant cities, weighted toward our customer geographies:
 *   North America, UK/Europe, Australia/NZ, Southeast Asia and East Asia,
 *   including the Chinese-diaspora hubs (Singapore, KL, Penang, Hong Kong,
 *   Taipei, major Chinese cities, Sydney, Melbourne, Vancouver, Toronto,
 *   San Francisco, Los Angeles, New York, London, …).
 * - Longitudes are given to 1 decimal place. 0.1° ≈ 24 s of solar time, so
 *   the resulting correction is well within a minute — finer than the
 *   day-level solar-term resolution the pillars depend on. Treat the values
 *   as accurate to roughly 0.1–0.5°; they are written from well-established
 *   geographic knowledge, not surveyed.
 * - utcOffsetMinutes is the region's STANDARD time offset. Historical and
 *   seasonal Daylight Saving Time is NOT modelled here — the birth clock may
 *   have read one hour later than standard. The widget therefore offers the
 *   user a "+1h daylight saving" toggle that adds 60 to this value; when in
 *   doubt the standard offset is the safe default.
 *
 * Works as a browser script (exposes `window.BaZiCities`) and as a CommonJS
 * module in Node.
 */
(function (global, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    global.BaZiCities = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // [name, country, longitudeEast, utcOffsetMinutes]
  const RAW = [
    // --- North America: United States -----------------------------------
    ['New York', 'United States', -74.0, -300],
    ['Brooklyn', 'United States', -73.9, -300],
    ['Boston', 'United States', -71.1, -300],
    ['Philadelphia', 'United States', -75.2, -300],
    ['Washington', 'United States', -77.0, -300],
    ['Atlanta', 'United States', -84.4, -300],
    ['Miami', 'United States', -80.2, -300],
    ['Orlando', 'United States', -81.4, -300],
    ['Charlotte', 'United States', -80.8, -300],
    ['Detroit', 'United States', -83.0, -300],
    ['Pittsburgh', 'United States', -80.0, -300],
    ['Cleveland', 'United States', -81.7, -300],
    ['Chicago', 'United States', -87.6, -360],
    ['Houston', 'United States', -95.4, -360],
    ['Dallas', 'United States', -96.8, -360],
    ['Austin', 'United States', -97.7, -360],
    ['San Antonio', 'United States', -98.5, -360],
    ['Minneapolis', 'United States', -93.3, -360],
    ['Kansas City', 'United States', -94.6, -360],
    ['New Orleans', 'United States', -90.1, -360],
    ['Denver', 'United States', -105.0, -420],
    ['Salt Lake City', 'United States', -111.9, -420],
    ['Phoenix', 'United States', -112.1, -420],
    ['Albuquerque', 'United States', -106.6, -420],
    ['Las Vegas', 'United States', -115.1, -480],
    ['Los Angeles', 'United States', -118.2, -480],
    ['San Diego', 'United States', -117.2, -480],
    ['San Francisco', 'United States', -122.4, -480],
    ['San Jose', 'United States', -121.9, -480],
    ['Sacramento', 'United States', -121.5, -480],
    ['Portland', 'United States', -122.7, -480],
    ['Seattle', 'United States', -122.3, -480],
    ['Anchorage', 'United States', -149.9, -540],
    ['Honolulu', 'United States', -157.9, -600],
    // --- North America: Canada ------------------------------------------
    ['Toronto', 'Canada', -79.4, -300],
    ['Ottawa', 'Canada', -75.7, -300],
    ['Montreal', 'Canada', -73.6, -300],
    ['Quebec City', 'Canada', -71.2, -300],
    ['Halifax', 'Canada', -63.6, -240],
    ['Winnipeg', 'Canada', -97.1, -360],
    ['Calgary', 'Canada', -114.1, -420],
    ['Edmonton', 'Canada', -113.5, -420],
    ['Vancouver', 'Canada', -123.1, -480],
    ['Victoria', 'Canada', -123.4, -480],
    // --- North America: Mexico & Central ---------------------------------
    ['Mexico City', 'Mexico', -99.1, -360],
    ['Guadalajara', 'Mexico', -103.3, -360],
    ['Monterrey', 'Mexico', -100.3, -360],
    ['Tijuana', 'Mexico', -117.0, -480],
    ['Cancún', 'Mexico', -86.8, -300],
    ['Guatemala City', 'Guatemala', -90.5, -360],
    ['San José', 'Costa Rica', -84.1, -360],
    ['Panama City', 'Panama', -79.5, -300],
    ['Havana', 'Cuba', -82.4, -300],
    ['Santo Domingo', 'Dominican Republic', -69.9, -240],
    ['San Juan', 'Puerto Rico', -66.1, -240],
    // --- South America ---------------------------------------------------
    ['Bogotá', 'Colombia', -74.1, -300],
    ['Medellín', 'Colombia', -75.6, -300],
    ['Lima', 'Peru', -77.0, -300],
    ['Quito', 'Ecuador', -78.5, -300],
    ['Caracas', 'Venezuela', -66.9, -240],
    ['Santiago', 'Chile', -70.6, -240],
    ['Buenos Aires', 'Argentina', -58.4, -180],
    ['Córdoba', 'Argentina', -64.2, -180],
    ['Montevideo', 'Uruguay', -56.2, -180],
    ['Asunción', 'Paraguay', -57.6, -240],
    ['La Paz', 'Bolivia', -68.1, -240],
    ['São Paulo', 'Brazil', -46.6, -180],
    ['Rio de Janeiro', 'Brazil', -43.2, -180],
    ['Brasília', 'Brazil', -47.9, -180],
    ['Salvador', 'Brazil', -38.5, -180],
    ['Fortaleza', 'Brazil', -38.5, -180],
    ['Recife', 'Brazil', -34.9, -180],
    ['Porto Alegre', 'Brazil', -51.2, -180],
    ['Manaus', 'Brazil', -60.0, -240],
    // --- United Kingdom & Ireland ---------------------------------------
    ['London', 'United Kingdom', -0.1, 0],
    ['Birmingham', 'United Kingdom', -1.9, 0],
    ['Manchester', 'United Kingdom', -2.2, 0],
    ['Liverpool', 'United Kingdom', -3.0, 0],
    ['Leeds', 'United Kingdom', -1.5, 0],
    ['Sheffield', 'United Kingdom', -1.5, 0],
    ['Bristol', 'United Kingdom', -2.6, 0],
    ['Newcastle', 'United Kingdom', -1.6, 0],
    ['Nottingham', 'United Kingdom', -1.1, 0],
    ['Cardiff', 'United Kingdom', -3.2, 0],
    ['Glasgow', 'United Kingdom', -4.3, 0],
    ['Edinburgh', 'United Kingdom', -3.2, 0],
    ['Aberdeen', 'United Kingdom', -2.1, 0],
    ['Belfast', 'United Kingdom', -6.0, 0],
    ['Dublin', 'Ireland', -6.3, 0],
    ['Cork', 'Ireland', -8.5, 0],
    // --- Western & Central Europe ---------------------------------------
    ['Paris', 'France', 2.4, 60],
    ['Marseille', 'France', 5.4, 60],
    ['Lyon', 'France', 4.8, 60],
    ['Toulouse', 'France', 1.4, 60],
    ['Nice', 'France', 7.3, 60],
    ['Bordeaux', 'France', -0.6, 60],
    ['Madrid', 'Spain', -3.7, 60],
    ['Barcelona', 'Spain', 2.2, 60],
    ['Valencia', 'Spain', -0.4, 60],
    ['Seville', 'Spain', -6.0, 60],
    ['Bilbao', 'Spain', -2.9, 60],
    ['Lisbon', 'Portugal', -9.1, 0],
    ['Porto', 'Portugal', -8.6, 0],
    ['Amsterdam', 'Netherlands', 4.9, 60],
    ['Rotterdam', 'Netherlands', 4.5, 60],
    ['The Hague', 'Netherlands', 4.3, 60],
    ['Brussels', 'Belgium', 4.4, 60],
    ['Antwerp', 'Belgium', 4.4, 60],
    ['Luxembourg', 'Luxembourg', 6.1, 60],
    ['Berlin', 'Germany', 13.4, 60],
    ['Hamburg', 'Germany', 10.0, 60],
    ['Munich', 'Germany', 11.6, 60],
    ['Cologne', 'Germany', 6.9, 60],
    ['Frankfurt', 'Germany', 8.7, 60],
    ['Stuttgart', 'Germany', 9.2, 60],
    ['Düsseldorf', 'Germany', 6.8, 60],
    ['Leipzig', 'Germany', 12.4, 60],
    ['Zurich', 'Switzerland', 8.5, 60],
    ['Geneva', 'Switzerland', 6.1, 60],
    ['Bern', 'Switzerland', 7.4, 60],
    ['Vienna', 'Austria', 16.4, 60],
    ['Salzburg', 'Austria', 13.1, 60],
    ['Milan', 'Italy', 9.2, 60],
    ['Rome', 'Italy', 12.5, 60],
    ['Naples', 'Italy', 14.3, 60],
    ['Turin', 'Italy', 7.7, 60],
    ['Florence', 'Italy', 11.3, 60],
    ['Venice', 'Italy', 12.3, 60],
    ['Bologna', 'Italy', 11.3, 60],
    ['Palermo', 'Italy', 13.4, 60],
    // --- Nordics --------------------------------------------------------
    ['Copenhagen', 'Denmark', 12.6, 60],
    ['Oslo', 'Norway', 10.7, 60],
    ['Bergen', 'Norway', 5.3, 60],
    ['Stockholm', 'Sweden', 18.1, 60],
    ['Gothenburg', 'Sweden', 12.0, 60],
    ['Helsinki', 'Finland', 24.9, 120],
    ['Reykjavik', 'Iceland', -21.9, 0],
    // --- Eastern & Southern Europe --------------------------------------
    ['Warsaw', 'Poland', 21.0, 60],
    ['Kraków', 'Poland', 19.9, 60],
    ['Prague', 'Czech Republic', 14.4, 60],
    ['Budapest', 'Hungary', 19.0, 60],
    ['Bratislava', 'Slovakia', 17.1, 60],
    ['Bucharest', 'Romania', 26.1, 120],
    ['Sofia', 'Bulgaria', 23.3, 120],
    ['Belgrade', 'Serbia', 20.5, 60],
    ['Zagreb', 'Croatia', 16.0, 60],
    ['Ljubljana', 'Slovenia', 14.5, 60],
    ['Athens', 'Greece', 23.7, 120],
    ['Thessaloniki', 'Greece', 22.9, 120],
    ['Kyiv', 'Ukraine', 30.5, 120],
    ['Moscow', 'Russia', 37.6, 180],
    ['Saint Petersburg', 'Russia', 30.3, 180],
    ['Novosibirsk', 'Russia', 82.9, 420],
    ['Vladivostok', 'Russia', 131.9, 600],
    ['Istanbul', 'Turkey', 29.0, 180],
    ['Ankara', 'Turkey', 32.9, 180],
    ['Izmir', 'Turkey', 27.1, 180],
    // --- Middle East ----------------------------------------------------
    ['Tel Aviv', 'Israel', 34.8, 120],
    ['Jerusalem', 'Israel', 35.2, 120],
    ['Beirut', 'Lebanon', 35.5, 120],
    ['Amman', 'Jordan', 35.9, 120],
    ['Dubai', 'United Arab Emirates', 55.3, 240],
    ['Abu Dhabi', 'United Arab Emirates', 54.4, 240],
    ['Doha', 'Qatar', 51.5, 180],
    ['Riyadh', 'Saudi Arabia', 46.7, 180],
    ['Jeddah', 'Saudi Arabia', 39.2, 180],
    ['Kuwait City', 'Kuwait', 47.9, 180],
    ['Manama', 'Bahrain', 50.6, 180],
    ['Muscat', 'Oman', 58.4, 240],
    ['Tehran', 'Iran', 51.4, 210],
    ['Baghdad', 'Iraq', 44.4, 180],
    // --- Africa ---------------------------------------------------------
    ['Cairo', 'Egypt', 31.2, 120],
    ['Alexandria', 'Egypt', 29.9, 120],
    ['Casablanca', 'Morocco', -7.6, 60],
    ['Rabat', 'Morocco', -6.8, 60],
    ['Marrakesh', 'Morocco', -8.0, 60],
    ['Tunis', 'Tunisia', 10.2, 60],
    ['Algiers', 'Algeria', 3.1, 60],
    ['Lagos', 'Nigeria', 3.4, 60],
    ['Abuja', 'Nigeria', 7.5, 60],
    ['Accra', 'Ghana', -0.2, 0],
    ['Nairobi', 'Kenya', 36.8, 180],
    ['Addis Ababa', 'Ethiopia', 38.7, 180],
    ['Dar es Salaam', 'Tanzania', 39.3, 180],
    ['Kampala', 'Uganda', 32.6, 180],
    ['Johannesburg', 'South Africa', 28.0, 120],
    ['Cape Town', 'South Africa', 18.4, 120],
    ['Durban', 'South Africa', 31.0, 120],
    ['Pretoria', 'South Africa', 28.2, 120],
    // --- South Asia -----------------------------------------------------
    ['Mumbai', 'India', 72.9, 330],
    ['Delhi', 'India', 77.2, 330],
    ['New Delhi', 'India', 77.2, 330],
    ['Bangalore', 'India', 77.6, 330],
    ['Hyderabad', 'India', 78.5, 330],
    ['Chennai', 'India', 80.3, 330],
    ['Kolkata', 'India', 88.4, 330],
    ['Pune', 'India', 73.9, 330],
    ['Ahmedabad', 'India', 72.6, 330],
    ['Jaipur', 'India', 75.8, 330],
    ['Karachi', 'Pakistan', 67.0, 300],
    ['Lahore', 'Pakistan', 74.3, 300],
    ['Islamabad', 'Pakistan', 73.0, 300],
    ['Dhaka', 'Bangladesh', 90.4, 360],
    ['Colombo', 'Sri Lanka', 79.9, 330],
    ['Kathmandu', 'Nepal', 85.3, 345],
    // --- Southeast Asia (customer-weighted) -----------------------------
    ['Singapore', 'Singapore', 103.8, 480],
    ['Kuala Lumpur', 'Malaysia', 101.7, 480],
    ['Penang', 'Malaysia', 100.3, 480],
    ['George Town', 'Malaysia', 100.3, 480],
    ['Johor Bahru', 'Malaysia', 103.8, 480],
    ['Ipoh', 'Malaysia', 101.1, 480],
    ['Malacca', 'Malaysia', 102.2, 480],
    ['Kuching', 'Malaysia', 110.3, 480],
    ['Kota Kinabalu', 'Malaysia', 116.1, 480],
    ['Bangkok', 'Thailand', 100.5, 420],
    ['Chiang Mai', 'Thailand', 98.9, 420],
    ['Phuket', 'Thailand', 98.4, 420],
    ['Jakarta', 'Indonesia', 106.8, 420],
    ['Surabaya', 'Indonesia', 112.7, 420],
    ['Bandung', 'Indonesia', 107.6, 420],
    ['Medan', 'Indonesia', 98.7, 420],
    ['Denpasar', 'Indonesia', 115.2, 480],
    ['Manila', 'Philippines', 121.0, 480],
    ['Quezon City', 'Philippines', 121.0, 480],
    ['Cebu City', 'Philippines', 123.9, 480],
    ['Davao', 'Philippines', 125.6, 480],
    ['Ho Chi Minh City', 'Vietnam', 106.7, 420],
    ['Hanoi', 'Vietnam', 105.8, 420],
    ['Da Nang', 'Vietnam', 108.2, 420],
    ['Phnom Penh', 'Cambodia', 104.9, 420],
    ['Yangon', 'Myanmar', 96.2, 390],
    ['Vientiane', 'Laos', 102.6, 420],
    ['Bandar Seri Begawan', 'Brunei', 114.9, 480],
    // --- East Asia: China (incl. diaspora origin hubs) ------------------
    ['Beijing', 'China', 116.4, 480],
    ['Shanghai', 'China', 121.5, 480],
    ['Guangzhou', 'China', 113.3, 480],
    ['Shenzhen', 'China', 114.1, 480],
    ['Chengdu', 'China', 104.1, 480],
    ['Chongqing', 'China', 106.5, 480],
    ['Wuhan', 'China', 114.3, 480],
    ['Xi’an', 'China', 108.9, 480],
    ['Hangzhou', 'China', 120.2, 480],
    ['Nanjing', 'China', 118.8, 480],
    ['Tianjin', 'China', 117.2, 480],
    ['Suzhou', 'China', 120.6, 480],
    ['Shenyang', 'China', 123.4, 480],
    ['Harbin', 'China', 126.6, 480],
    ['Dalian', 'China', 121.6, 480],
    ['Qingdao', 'China', 120.4, 480],
    ['Jinan', 'China', 117.0, 480],
    ['Zhengzhou', 'China', 113.6, 480],
    ['Changsha', 'China', 112.9, 480],
    ['Kunming', 'China', 102.7, 480],
    ['Nanning', 'China', 108.4, 480],
    ['Fuzhou', 'China', 119.3, 480],
    ['Xiamen', 'China', 118.1, 480],
    ['Quanzhou', 'China', 118.6, 480],
    ['Shantou', 'China', 116.7, 480],
    ['Dongguan', 'China', 113.8, 480],
    ['Foshan', 'China', 113.1, 480],
    ['Zhuhai', 'China', 113.6, 480],
    ['Taiyuan', 'China', 112.5, 480],
    ['Lanzhou', 'China', 103.8, 480],
    ['Ürümqi', 'China', 87.6, 480],
    ['Lhasa', 'China', 91.1, 480],
    ['Hohhot', 'China', 111.7, 480],
    ['Guiyang', 'China', 106.7, 480],
    ['Nanchang', 'China', 115.9, 480],
    ['Hefei', 'China', 117.3, 480],
    ['Ningbo', 'China', 121.6, 480],
    ['Wenzhou', 'China', 120.7, 480],
    // --- East Asia: Hong Kong, Macau, Taiwan ----------------------------
    ['Hong Kong', 'Hong Kong', 114.2, 480],
    ['Kowloon', 'Hong Kong', 114.2, 480],
    ['Macau', 'Macau', 113.5, 480],
    ['Taipei', 'Taiwan', 121.6, 480],
    ['New Taipei', 'Taiwan', 121.5, 480],
    ['Taichung', 'Taiwan', 120.7, 480],
    ['Kaohsiung', 'Taiwan', 120.3, 480],
    ['Tainan', 'Taiwan', 120.2, 480],
    ['Hsinchu', 'Taiwan', 120.9, 480],
    // --- East Asia: Japan & Korea ---------------------------------------
    ['Tokyo', 'Japan', 139.7, 540],
    ['Yokohama', 'Japan', 139.6, 540],
    ['Osaka', 'Japan', 135.5, 540],
    ['Kyoto', 'Japan', 135.8, 540],
    ['Nagoya', 'Japan', 136.9, 540],
    ['Sapporo', 'Japan', 141.4, 540],
    ['Fukuoka', 'Japan', 130.4, 540],
    ['Kobe', 'Japan', 135.2, 540],
    ['Hiroshima', 'Japan', 132.5, 540],
    ['Sendai', 'Japan', 140.9, 540],
    ['Seoul', 'South Korea', 127.0, 540],
    ['Busan', 'South Korea', 129.1, 540],
    ['Incheon', 'South Korea', 126.7, 540],
    ['Daegu', 'South Korea', 128.6, 540],
    ['Daejeon', 'South Korea', 127.4, 540],
    ['Gwangju', 'South Korea', 126.9, 540],
    ['Ulaanbaatar', 'Mongolia', 106.9, 480],
    // --- Australia & New Zealand ----------------------------------------
    ['Sydney', 'Australia', 151.2, 600],
    ['Melbourne', 'Australia', 145.0, 600],
    ['Brisbane', 'Australia', 153.0, 600],
    ['Gold Coast', 'Australia', 153.4, 600],
    ['Canberra', 'Australia', 149.1, 600],
    ['Newcastle', 'Australia', 151.8, 600],
    ['Adelaide', 'Australia', 138.6, 570],
    ['Perth', 'Australia', 115.9, 480],
    ['Darwin', 'Australia', 130.8, 570],
    ['Hobart', 'Australia', 147.3, 600],
    ['Cairns', 'Australia', 145.8, 600],
    ['Auckland', 'New Zealand', 174.8, 720],
    ['Wellington', 'New Zealand', 174.8, 720],
    ['Christchurch', 'New Zealand', 172.6, 720],
    ['Hamilton', 'New Zealand', 175.3, 720],
    ['Dunedin', 'New Zealand', 170.5, 720],
    ['Suva', 'Fiji', 178.4, 720],
    ['Port Moresby', 'Papua New Guinea', 147.2, 600],
  ];

  const CITIES = RAW.map(function (r) {
    return { name: r[0], country: r[1], longitude: r[2], utcOffsetMinutes: r[3] };
  });

  /**
   * Case-insensitive search over "City" and "City, Country".
   * Prefix matches rank above substring matches. Returns up to `limit`
   * entries (default 5). An empty/blank query returns [].
   */
  function search(query, limit) {
    limit = typeof limit === 'number' && limit > 0 ? limit : 5;
    const q = String(query == null ? '' : query).trim().toLowerCase();
    if (!q) return [];
    const prefix = [];
    const substr = [];
    for (const c of CITIES) {
      const name = c.name.toLowerCase();
      const full = (c.name + ', ' + c.country).toLowerCase();
      if (name.startsWith(q) || full.startsWith(q)) {
        prefix.push(c);
      } else if (name.indexOf(q) !== -1 || full.indexOf(q) !== -1) {
        substr.push(c);
      }
      if (prefix.length >= limit) break;
    }
    return prefix.concat(substr).slice(0, limit);
  }

  return { cities: CITIES, search };
});
