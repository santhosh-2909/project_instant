/**
 * Location reference data.
 *
 * Deliberately static rather than database-backed. Country/state/city lists are
 * fixed reference data that changes once a decade, so serving them from
 * Postgres bought nothing and cost plenty: the registration form was unusable
 * whenever the database was unreachable or unseeded, and it made three network
 * round-trips to populate three dropdowns.
 *
 * The seed previously carried one Indian state (Telangana), so a user from
 * anywhere else in the country could not register at all. All 28 states and 8
 * union territories are covered here.
 *
 * The database remains the source of truth for *user records*: on registration
 * the server upserts the chosen country/state/city so the foreign keys in
 * `prisma/schema.prisma` still resolve. See `server/data/locations.ts`.
 */

export interface CountryData {
  name: string;
  /** ISO 3166-1 alpha-2, for flags and future i18n. */
  code: string;
  states: StateData[];
}

export interface StateData {
  name: string;
  cities: string[];
}

/** India first — it is the PRD's primary market. */
export const COUNTRIES: CountryData[] = [
  {
    name: 'India',
    code: 'IN',
    states: [
      { name: 'Andaman and Nicobar Islands', cities: ['Port Blair', 'Diglipur', 'Rangat'] },
      { name: 'Andhra Pradesh', cities: ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Kurnool', 'Tirupati', 'Rajahmundry'] },
      { name: 'Arunachal Pradesh', cities: ['Itanagar', 'Naharlagun', 'Pasighat', 'Tawang'] },
      { name: 'Assam', cities: ['Guwahati', 'Silchar', 'Dibrugarh', 'Jorhat', 'Nagaon', 'Tezpur'] },
      { name: 'Bihar', cities: ['Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Darbhanga', 'Purnia'] },
      { name: 'Chandigarh', cities: ['Chandigarh'] },
      { name: 'Chhattisgarh', cities: ['Raipur', 'Bhilai', 'Bilaspur', 'Korba', 'Durg'] },
      { name: 'Dadra and Nagar Haveli and Daman and Diu', cities: ['Daman', 'Silvassa', 'Diu'] },
      { name: 'Delhi', cities: ['New Delhi', 'Dwarka', 'Rohini', 'Saket', 'Karol Bagh'] },
      { name: 'Goa', cities: ['Panaji', 'Margao', 'Vasco da Gama', 'Mapusa'] },
      { name: 'Gujarat', cities: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar', 'Gandhinagar'] },
      { name: 'Haryana', cities: ['Gurugram', 'Faridabad', 'Panipat', 'Ambala', 'Karnal', 'Hisar'] },
      { name: 'Himachal Pradesh', cities: ['Shimla', 'Dharamshala', 'Solan', 'Mandi', 'Kullu'] },
      { name: 'Jammu and Kashmir', cities: ['Srinagar', 'Jammu', 'Anantnag', 'Baramulla'] },
      { name: 'Jharkhand', cities: ['Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro', 'Deoghar'] },
      { name: 'Karnataka', cities: ['Bengaluru', 'Mysuru', 'Hubballi', 'Mangaluru', 'Belagavi', 'Davanagere', 'Ballari'] },
      { name: 'Kerala', cities: ['Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur', 'Kollam', 'Kannur', 'Alappuzha'] },
      { name: 'Ladakh', cities: ['Leh', 'Kargil'] },
      { name: 'Lakshadweep', cities: ['Kavaratti', 'Agatti'] },
      { name: 'Madhya Pradesh', cities: ['Bhopal', 'Indore', 'Jabalpur', 'Gwalior', 'Ujjain', 'Sagar'] },
      { name: 'Maharashtra', cities: ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Thane', 'Aurangabad', 'Solapur', 'Kolhapur'] },
      { name: 'Manipur', cities: ['Imphal', 'Thoubal', 'Bishnupur'] },
      { name: 'Meghalaya', cities: ['Shillong', 'Tura', 'Jowai'] },
      { name: 'Mizoram', cities: ['Aizawl', 'Lunglei', 'Champhai'] },
      { name: 'Nagaland', cities: ['Kohima', 'Dimapur', 'Mokokchung'] },
      { name: 'Odisha', cities: ['Bhubaneswar', 'Cuttack', 'Rourkela', 'Berhampur', 'Sambalpur', 'Puri'] },
      { name: 'Puducherry', cities: ['Puducherry', 'Karaikal', 'Yanam', 'Mahe'] },
      { name: 'Punjab', cities: ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda', 'Mohali'] },
      { name: 'Rajasthan', cities: ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Ajmer', 'Bikaner'] },
      { name: 'Sikkim', cities: ['Gangtok', 'Namchi', 'Gyalshing'] },
      {
        name: 'Tamil Nadu',
        cities: ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli', 'Erode', 'Vellore', 'Thoothukudi', 'Thanjavur'],
      },
      { name: 'Telangana', cities: ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Khammam', 'Secunderabad'] },
      { name: 'Tripura', cities: ['Agartala', 'Udaipur', 'Dharmanagar'] },
      { name: 'Uttar Pradesh', cities: ['Lucknow', 'Kanpur', 'Ghaziabad', 'Agra', 'Varanasi', 'Prayagraj', 'Meerut', 'Noida'] },
      { name: 'Uttarakhand', cities: ['Dehradun', 'Haridwar', 'Roorkee', 'Haldwani', 'Rishikesh'] },
      { name: 'West Bengal', cities: ['Kolkata', 'Howrah', 'Durgapur', 'Asansol', 'Siliguri', 'Darjeeling'] },
    ],
  },
  {
    name: 'United States',
    code: 'US',
    states: [
      { name: 'California', cities: ['Los Angeles', 'San Francisco', 'San Diego', 'San Jose', 'Sacramento'] },
      { name: 'New York', cities: ['New York City', 'Buffalo', 'Rochester', 'Albany'] },
      { name: 'Texas', cities: ['Houston', 'Dallas', 'Austin', 'San Antonio'] },
      { name: 'Florida', cities: ['Miami', 'Orlando', 'Tampa', 'Jacksonville'] },
      { name: 'Illinois', cities: ['Chicago', 'Springfield', 'Naperville'] },
      { name: 'Washington', cities: ['Seattle', 'Spokane', 'Tacoma'] },
      { name: 'Massachusetts', cities: ['Boston', 'Cambridge', 'Worcester'] },
      { name: 'New Jersey', cities: ['Newark', 'Jersey City', 'Princeton'] },
    ],
  },
  {
    name: 'United Kingdom',
    code: 'GB',
    states: [
      { name: 'England', cities: ['London', 'Manchester', 'Birmingham', 'Leeds', 'Liverpool', 'Bristol'] },
      { name: 'Scotland', cities: ['Edinburgh', 'Glasgow', 'Aberdeen', 'Dundee'] },
      { name: 'Wales', cities: ['Cardiff', 'Swansea', 'Newport'] },
      { name: 'Northern Ireland', cities: ['Belfast', 'Londonderry', 'Lisburn'] },
    ],
  },
  {
    name: 'Canada',
    code: 'CA',
    states: [
      { name: 'Ontario', cities: ['Toronto', 'Ottawa', 'Mississauga', 'Hamilton'] },
      { name: 'Quebec', cities: ['Montreal', 'Quebec City', 'Laval'] },
      { name: 'British Columbia', cities: ['Vancouver', 'Victoria', 'Surrey'] },
      { name: 'Alberta', cities: ['Calgary', 'Edmonton', 'Red Deer'] },
    ],
  },
  {
    name: 'Australia',
    code: 'AU',
    states: [
      { name: 'New South Wales', cities: ['Sydney', 'Newcastle', 'Wollongong'] },
      { name: 'Victoria', cities: ['Melbourne', 'Geelong', 'Ballarat'] },
      { name: 'Queensland', cities: ['Brisbane', 'Gold Coast', 'Cairns'] },
      { name: 'Western Australia', cities: ['Perth', 'Fremantle', 'Bunbury'] },
    ],
  },
  {
    name: 'United Arab Emirates',
    code: 'AE',
    states: [
      { name: 'Dubai', cities: ['Dubai', 'Deira', 'Jebel Ali'] },
      { name: 'Abu Dhabi', cities: ['Abu Dhabi', 'Al Ain'] },
      { name: 'Sharjah', cities: ['Sharjah', 'Khor Fakkan'] },
    ],
  },
  {
    name: 'Singapore',
    code: 'SG',
    states: [{ name: 'Singapore', cities: ['Singapore'] }],
  },
  {
    name: 'Sri Lanka',
    code: 'LK',
    states: [
      { name: 'Western Province', cities: ['Colombo', 'Negombo', 'Moratuwa'] },
      { name: 'Central Province', cities: ['Kandy', 'Matale', 'Nuwara Eliya'] },
      { name: 'Northern Province', cities: ['Jaffna', 'Vavuniya'] },
    ],
  },
  {
    name: 'Malaysia',
    code: 'MY',
    states: [
      { name: 'Kuala Lumpur', cities: ['Kuala Lumpur'] },
      { name: 'Selangor', cities: ['Shah Alam', 'Petaling Jaya', 'Subang Jaya'] },
      { name: 'Penang', cities: ['George Town', 'Butterworth'] },
    ],
  },
  {
    name: 'Germany',
    code: 'DE',
    states: [
      { name: 'Bavaria', cities: ['Munich', 'Nuremberg', 'Augsburg'] },
      { name: 'Berlin', cities: ['Berlin'] },
      { name: 'North Rhine-Westphalia', cities: ['Cologne', 'Düsseldorf', 'Dortmund'] },
    ],
  },
];

/** Fixed reference data, previously DB-backed for no benefit. */
export const SECURITY_QUESTIONS: string[] = [
  'What city were you born in?',
  'What was the name of your first school?',
  "What is your mother's maiden name?",
  'What was the name of your first pet?',
  'What is your favourite book?',
  'What was the make of your first vehicle?',
];

/* ------------------------------------------------------------------ Lookups */

export const countryNames = (): string[] => COUNTRIES.map((c) => c.name);

export function findCountry(name: string): CountryData | undefined {
  const key = name?.trim().toLowerCase();
  return COUNTRIES.find((c) => c.name.toLowerCase() === key);
}

export function statesOf(countryName: string): StateData[] {
  return findCountry(countryName)?.states ?? [];
}

export function citiesOf(countryName: string, stateName: string): string[] {
  const key = stateName?.trim().toLowerCase();
  return statesOf(countryName).find((s) => s.name.toLowerCase() === key)?.cities ?? [];
}

/**
 * Validates a country/state/city triple.
 *
 * The server must not trust the client to have used the dropdowns: a crafted
 * request could otherwise create arbitrary rows in the location tables.
 */
export function isValidLocation(country: string, state: string, city: string): boolean {
  if (!country || !state || !city) return false;
  const cities = citiesOf(country, state);
  return cities.some((c) => c.toLowerCase() === city.trim().toLowerCase());
}

export const isValidSecurityQuestion = (question: string): boolean =>
  SECURITY_QUESTIONS.includes(question?.trim());
