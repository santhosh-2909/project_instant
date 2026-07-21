import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get('keyword') || '';
    const categoryId = searchParams.get('categoryId');
    const sourceId = searchParams.get('sourceId');
    const countryId = searchParams.get('countryId');
    const languageId = searchParams.get('languageId');
    const date = searchParams.get('date');

    // 1. Check if we need to seed mock articles
    const articleCount = await db.newsArticle.count();
    if (articleCount === 0) {
      console.log('Seeding mock news articles into DB...');
      
      const bbc = await db.newsSource.findFirst({ where: { sourceName: 'BBC News' } });
      const toi = await db.newsSource.findFirst({ where: { sourceName: 'Times of India' } });
      
      const politics = await db.newsCategory.findFirst({ where: { categoryName: 'Politics' } });
      const tech = await db.newsCategory.findFirst({ where: { categoryName: 'Technology' } });
      const sports = await db.newsCategory.findFirst({ where: { categoryName: 'Sports' } });
      const health = await db.newsCategory.findFirst({ where: { categoryName: 'Health' } });
      const business = await db.newsCategory.findFirst({ where: { categoryName: 'Business' } });

      const india = await db.country.findFirst({ where: { countryName: 'India' } });
      const usa = await db.country.findFirst({ where: { countryName: 'United States' } });
      const uk = await db.country.findFirst({ where: { countryName: 'United Kingdom' } });

      const english = await db.language.findFirst({ where: { languageName: 'English' } });

      if (bbc && toi && politics && tech && sports && health && business && india && usa && uk && english) {
        await db.newsArticle.createMany({
          data: [
            {
              title: 'Global Leaders Align on Climate Action Targets for 2026',
              description: 'World leaders meeting in London have committed to stricter carbon neutral deadlines.',
              content: 'At the summit held in London, heads of state from major economies finalized a treaty enforcing immediate reductions in carbon output. The pact introduces binding penalties for non-compliance starting in 2028, marking the most aggressive international environmental legislation to date.',
              author: 'Sarah Jenkins',
              publishedDate: new Date('2026-07-10'),
              sourceId: bbc.sourceId,
              categoryId: politics.categoryId,
              languageId: english.languageId,
              countryId: uk.countryId,
              status: 'Retrieved',
              imageURL: 'https://images.unsplash.com/photo-1611273426858-450d8e3c9fce',
              newsURL: 'https://www.bbc.com/news/climate-2026',
            },
            {
              title: 'Breakthrough AI Model Demonstrates Zero-Shot Reason Capabilities',
              description: 'Tech giants announce a new LLM model capable of reasoning complex mathematical proofs.',
              content: 'A joint laboratory in San Francisco has unveiled a new model named Gemini 3.0 Ultra. During public tests, the neural network solved several unsolved geometric proofs without prior fine-tuning, demonstrating advanced logical reasoning properties previously unseen in generative models.',
              author: 'Alex Carter',
              publishedDate: new Date('2026-07-12'),
              sourceId: bbc.sourceId,
              categoryId: tech.categoryId,
              languageId: english.languageId,
              countryId: usa.countryId,
              status: 'Retrieved',
              imageURL: 'https://images.unsplash.com/photo-1677442136019-21780efad99a',
              newsURL: 'https://www.bbc.com/news/tech-reasoning',
            },
            {
              title: 'India Unveils Massive Semiconductor Manufacturing Hub in Hyderabad',
              description: 'The plant is expected to meet 15% of global chip requirements by 2028.',
              content: 'The government of India, in partnership with top global manufacturers, has inaugurated a 500-acre chip assembly and design center near Hyderabad. The initiative aims to make the state a major semiconductor exporter, reducing supply-chain reliance on East Asian hubs.',
              author: 'Rohan Sharma',
              publishedDate: new Date('2026-07-14'),
              sourceId: toi.sourceId,
              categoryId: tech.categoryId,
              languageId: english.languageId,
              countryId: india.countryId,
              status: 'Retrieved',
              imageURL: 'https://images.unsplash.com/photo-1518770660439-4636190af475',
              newsURL: 'https://timesofindia.indiatimes.com/tech-hub-hyderabad',
            },
            {
              title: 'Health Benefits of Daily Yoga Confirmed in Long-Term Clinical Trial',
              description: 'A 10-year study by medical researchers shows regular yoga practice prevents chronic diseases.',
              content: 'A clinical study analyzing 10,000 participants over a decade has verified that practicing yoga for at least 20 minutes daily reduces the risk of cardiovascular ailments by 34% and improves stress levels by 45%. Researchers noted the findings suggest yoga can be officially recommended for preventative health guidelines.',
              author: 'Dr. Priya Patel',
              publishedDate: new Date('2026-07-05'),
              sourceId: toi.sourceId,
              categoryId: health.categoryId,
              languageId: english.languageId,
              countryId: india.countryId,
              status: 'Retrieved',
              imageURL: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b',
              newsURL: 'https://timesofindia.indiatimes.com/yoga-trial-results',
            },
            {
              title: 'Global Stocks Plunge Amid Rising Trade Tariffs Concerns',
              description: 'Markets in New York, London, and Tokyo closed in the red as trade tensions escalate.',
              content: 'Indices dropped sharply yesterday as governments announced new retaliatory tariff lists. Economists warn that these trade barriers could reduce global GDP growth by 1.2% over the next two fiscal quarters, triggering inflation concerns in consumer products.',
              author: 'Marcie Stone',
              publishedDate: new Date('2026-07-15'),
              sourceId: bbc.sourceId,
              categoryId: business.categoryId,
              languageId: english.languageId,
              countryId: usa.countryId,
              status: 'Retrieved',
              imageURL: 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f',
              newsURL: 'https://www.bbc.com/news/finance-tariffs',
            },
          ],
        });
      }
    }

    // 2. Build where filter clauses dynamically
    const where: any = {};

    if (keyword) {
      where.OR = [
        { title: { contains: keyword, mode: 'insensitive' } },
        { description: { contains: keyword, mode: 'insensitive' } },
        { content: { contains: keyword, mode: 'insensitive' } },
      ];
    }

    if (categoryId) {
      where.categoryId = Number(categoryId);
    }

    if (sourceId) {
      where.sourceId = Number(sourceId);
    }

    if (countryId) {
      where.countryId = Number(countryId);
    }

    if (languageId) {
      where.languageId = Number(languageId);
    }

    if (date) {
      const parsedDate = new Date(date);
      // Filter for the entire day
      const startOfDay = new Date(parsedDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(parsedDate.setHours(23, 59, 59, 999));
      where.publishedDate = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }

    // 3. Query Database
    const articles = await db.newsArticle.findMany({
      where,
      include: {
        source: true,
        category: true,
        language: true,
        country: true,
      },
      orderBy: { publishedDate: 'desc' },
    });

    // 4. Log Retrieval History
    // Write success status
    if (articles.length > 0) {
      await Promise.all(
        articles.map((article) =>
          db.retrievalHistory.create({
            data: {
              articleId: article.articleId,
              retrievalStatus: 'Success',
            },
          })
        )
      );
    }

    return NextResponse.json({
      message: 'News retrieved successfully.',
      count: articles.length,
      articles,
    });
  } catch (error) {
    console.error('Error fetching news:', error);
    return NextResponse.json({ error: 'Failed to retrieve news articles.' }, { status: 500 });
  }
}
