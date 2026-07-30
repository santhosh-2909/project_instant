/*
 * BACKEND ONLY. The `server-only` import below makes this a build error if any
 * client component ever imports this module, directly or transitively.
 */
import 'server-only';

import { db } from '@/server/data/db';
import { isValidLocation, isValidSecurityQuestion } from '@/shared/locations';

/**
 * Resolves location names to database rows, creating them on first use.
 *
 * The dropdowns are served from static data (`shared/locations.ts`) so the
 * registration form works without a seeded database. But `User` has foreign
 * keys to Country/State/City, so those rows must exist before a user can be
 * written. Rather than pre-seeding thousands of rows that may never be used,
 * each location is created the first time somebody registers from it.
 *
 * The input is validated against the static dataset first — otherwise a crafted
 * request could write arbitrary rows into the location tables.
 */
export interface ResolvedLocation {
  countryId: number;
  stateId: number;
  cityId: number;
}

export class InvalidLocationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidLocationError';
  }
}

export async function resolveLocation(
  countryName: string,
  stateName: string,
  cityName: string
): Promise<ResolvedLocation> {
  const country = countryName?.trim();
  const state = stateName?.trim();
  const city = cityName?.trim();

  if (!isValidLocation(country, state, city)) {
    throw new InvalidLocationError('Select a country, state and city from the lists provided.');
  }

  // Sequential by necessity: each level needs the parent's id.
  const countryRow = await db.country.upsert({
    where: { countryName: country },
    update: {},
    create: { countryName: country },
  });

  const stateRow = await db.state.upsert({
    where: { stateName_countryId: { stateName: state, countryId: countryRow.countryId } },
    update: {},
    create: { stateName: state, countryId: countryRow.countryId },
  });

  const cityRow = await db.city.upsert({
    where: { cityName_stateId: { cityName: city, stateId: stateRow.stateId } },
    update: {},
    create: { cityName: city, stateId: stateRow.stateId },
  });

  return {
    countryId: countryRow.countryId,
    stateId: stateRow.stateId,
    cityId: cityRow.cityId,
  };
}

/** Same pattern for security questions, which are also fixed reference data. */
export async function resolveSecurityQuestion(question: string): Promise<number> {
  const value = question?.trim();

  if (!isValidSecurityQuestion(value)) {
    throw new InvalidLocationError('Select a security question from the list provided.');
  }

  const row = await db.securityQuestion.upsert({
    where: { question: value },
    update: {},
    create: { question: value },
  });

  return row.securityQuestionId;
}
