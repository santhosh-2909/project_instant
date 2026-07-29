import { NextResponse } from 'next/server';
import { db } from '@/server/data/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const countryId = searchParams.get('countryId');
    const stateId = searchParams.get('stateId');

    // If countryId is passed, return only states for that country
    if (countryId && !stateId) {
      const states = await db.state.findMany({
        where: { countryId: Number(countryId) },
        orderBy: { stateName: 'asc' },
      });
      return NextResponse.json({ states });
    }

    // If stateId is passed, return only cities for that state
    if (stateId) {
      const cities = await db.city.findMany({
        where: { stateId: Number(stateId) },
        orderBy: { cityName: 'asc' },
      });
      return NextResponse.json({ cities });
    }

    // Otherwise, return all base reference data for forms & filters
    const [
      countries,
      categories,
      sources,
      languages,
      securityQuestions,
    ] = await Promise.all([
      db.country.findMany({ orderBy: { countryName: 'asc' } }),
      db.newsCategory.findMany({ orderBy: { categoryName: 'asc' } }),
      db.newsSource.findMany({ where: { status: 'Active' }, orderBy: { sourceName: 'asc' } }),
      db.language.findMany({ orderBy: { languageName: 'asc' } }),
      db.securityQuestion.findMany(),
    ]);

    return NextResponse.json({
      countries,
      categories,
      sources,
      languages,
      securityQuestions,
    });
  } catch (error) {
    console.error('Error fetching source list:', error);
    return NextResponse.json({ error: 'Failed to fetch references.' }, { status: 500 });
  }
}
