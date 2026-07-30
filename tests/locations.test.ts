import { describe, it, expect } from 'vitest';
import {
  COUNTRIES,
  SECURITY_QUESTIONS,
  citiesOf,
  countryNames,
  findCountry,
  isValidLocation,
  isValidSecurityQuestion,
  statesOf,
} from '@/shared/locations';

describe('TC-LOC-01 country list', () => {
  it('is not empty — the bug that started this', () => {
    // The dropdown was fed from the database. With no DATABASE_URL the endpoint
    // 500'd and every option vanished, so nobody could register at all.
    expect(COUNTRIES.length).toBeGreaterThan(5);
    expect(countryNames()).toContain('India');
  });

  it('lists India first, matching the product’s primary market', () => {
    expect(COUNTRIES[0].name).toBe('India');
  });

  it('gives every country a unique ISO code and at least one state', () => {
    const codes = COUNTRIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const country of COUNTRIES) {
      expect(country.states.length).toBeGreaterThan(0);
    }
  });

  it('gives every state at least one city', () => {
    const empty: string[] = [];
    for (const country of COUNTRIES) {
      for (const state of country.states) {
        if (state.cities.length === 0) empty.push(`${country.name}/${state.name}`);
      }
    }
    expect(empty).toEqual([]);
  });

  it('has no duplicate state names within a country', () => {
    for (const country of COUNTRIES) {
      const names = country.states.map((s) => s.name);
      expect(new Set(names).size).toBe(names.length);
    }
  });
});

describe('TC-LOC-02 Indian coverage (the seed had only Telangana)', () => {
  const india = findCountry('India')!;

  it('covers all 28 states and 8 union territories', () => {
    expect(india.states.length).toBe(36);
  });

  it('includes Tamil Nadu, which the old seed omitted entirely', () => {
    const tn = india.states.find((s) => s.name === 'Tamil Nadu');
    expect(tn).toBeDefined();
    expect(tn!.cities).toContain('Chennai');
    expect(tn!.cities).toContain('Coimbatore');
  });

  it('includes the other populous states a user is likely to pick', () => {
    const names = india.states.map((s) => s.name);
    for (const state of ['Maharashtra', 'Uttar Pradesh', 'Karnataka', 'West Bengal', 'Kerala', 'Gujarat', 'Delhi']) {
      expect(names).toContain(state);
    }
  });
});

describe('TC-LOC-03 cascading lookups', () => {
  it('returns states for a known country', () => {
    expect(statesOf('India').length).toBe(36);
    expect(statesOf('United Kingdom').map((s) => s.name)).toContain('Scotland');
  });

  it('returns cities for a known state', () => {
    expect(citiesOf('India', 'Tamil Nadu')).toContain('Madurai');
    expect(citiesOf('United States', 'California')).toContain('San Francisco');
  });

  it('is case-insensitive', () => {
    expect(statesOf('india').length).toBe(36);
    expect(citiesOf('INDIA', 'tamil nadu')).toContain('Chennai');
  });

  it('returns an empty list rather than throwing for unknown input', () => {
    expect(statesOf('Atlantis')).toEqual([]);
    expect(citiesOf('India', 'Nowhere')).toEqual([]);
    expect(citiesOf('', '')).toEqual([]);
  });
});

describe('TC-LOC-04 isValidLocation() — server-side trust boundary', () => {
  it('accepts a genuine triple', () => {
    expect(isValidLocation('India', 'Tamil Nadu', 'Chennai')).toBe(true);
    expect(isValidLocation('United Kingdom', 'Scotland', 'Edinburgh')).toBe(true);
  });

  it('rejects a city that does not belong to the state', () => {
    // Without this the server would happily create "Chennai, Scotland".
    expect(isValidLocation('United Kingdom', 'Scotland', 'Chennai')).toBe(false);
  });

  it('rejects a state that does not belong to the country', () => {
    expect(isValidLocation('United States', 'Tamil Nadu', 'Chennai')).toBe(false);
  });

  it('rejects invented values — a crafted request must not create rows', () => {
    expect(isValidLocation('Atlantis', 'Deep', 'Reef')).toBe(false);
    expect(isValidLocation('India', 'Tamil Nadu', '<script>alert(1)</script>')).toBe(false);
  });

  it('rejects missing parts', () => {
    expect(isValidLocation('', 'Tamil Nadu', 'Chennai')).toBe(false);
    expect(isValidLocation('India', '', 'Chennai')).toBe(false);
    expect(isValidLocation('India', 'Tamil Nadu', '')).toBe(false);
  });

  it('tolerates surrounding whitespace', () => {
    expect(isValidLocation('India', 'Tamil Nadu', '  Chennai  ')).toBe(true);
  });
});

describe('TC-LOC-05 security questions', () => {
  it('offers a usable set', () => {
    expect(SECURITY_QUESTIONS.length).toBeGreaterThanOrEqual(5);
    expect(new Set(SECURITY_QUESTIONS).size).toBe(SECURITY_QUESTIONS.length);
  });

  it('accepts only questions from the list', () => {
    expect(isValidSecurityQuestion(SECURITY_QUESTIONS[0])).toBe(true);
    expect(isValidSecurityQuestion('What is my bank PIN?')).toBe(false);
    expect(isValidSecurityQuestion('')).toBe(false);
  });
});
