import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

/**
 * Mirrors `normaliseSecurityAnswer` in src/server/auth/securityAnswer.ts.
 * Duplicated rather than imported because that module is marked `server-only`,
 * which cannot resolve in a standalone ts-node script. The two must agree — a
 * test in tests/security.test.ts pins the normalisation rules.
 */
function normaliseSecurityAnswer(answer: string): string {
  return answer.trim().toLowerCase().replace(/\s+/g, ' ');
}

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding reference tables...');

  // 1. Roles
  const adminRole = await prisma.role.upsert({
    where: { roleName: 'Admin' },
    update: {},
    create: { roleName: 'Admin' },
  });
  const userRole = await prisma.role.upsert({
    where: { roleName: 'Regular User' },
    update: {},
    create: { roleName: 'Regular User' },
  });

  // 2. Account Status
  const statusActive = await prisma.accountStatus.upsert({
    where: { statusName: 'Active' },
    update: {},
    create: { statusName: 'Active', description: 'User account is active' },
  });
  await prisma.accountStatus.upsert({
    where: { statusName: 'Inactive' },
    update: {},
    create: { statusName: 'Inactive', description: 'User account is deactivated' },
  });
  await prisma.accountStatus.upsert({
    where: { statusName: 'Locked' },
    update: {},
    create: { statusName: 'Locked', description: 'User account is locked due to security reasons' },
  });

  // 3. Countries
  const india = await prisma.country.upsert({
    where: { countryName: 'India' },
    update: {},
    create: { countryName: 'India' },
  });
  const usa = await prisma.country.upsert({
    where: { countryName: 'United States' },
    update: {},
    create: { countryName: 'United States' },
  });
  const uk = await prisma.country.upsert({
    where: { countryName: 'United Kingdom' },
    update: {},
    create: { countryName: 'United Kingdom' },
  });

  // 4. States
  const telangana = await prisma.state.upsert({
    where: { stateName_countryId: { stateName: 'Telangana', countryId: india.countryId } },
    update: {},
    create: { stateName: 'Telangana', countryId: india.countryId },
  });
  const newyork = await prisma.state.upsert({
    where: { stateName_countryId: { stateName: 'New York', countryId: usa.countryId } },
    update: {},
    create: { stateName: 'New York', countryId: usa.countryId },
  });
  const england = await prisma.state.upsert({
    where: { stateName_countryId: { stateName: 'England', countryId: uk.countryId } },
    update: {},
    create: { stateName: 'England', countryId: uk.countryId },
  });

  // 5. Cities
  const hyderabad = await prisma.city.upsert({
    where: { cityName_stateId: { cityName: 'Hyderabad', stateId: telangana.stateId } },
    update: {},
    create: { cityName: 'Hyderabad', stateId: telangana.stateId },
  });
  await prisma.city.upsert({
    where: { cityName_stateId: { cityName: 'New York City', stateId: newyork.stateId } },
    update: {},
    create: { cityName: 'New York City', stateId: newyork.stateId },
  });
  await prisma.city.upsert({
    where: { cityName_stateId: { cityName: 'London', stateId: england.stateId } },
    update: {},
    create: { cityName: 'London', stateId: england.stateId },
  });

  // 6. Security Questions
  const sq1 = await prisma.securityQuestion.upsert({
    where: { question: 'What was the name of your first school?' },
    update: {},
    create: { question: 'What was the name of your first school?' },
  });
  await prisma.securityQuestion.upsert({
    where: { question: "What is your mother's maiden name?" },
    update: {},
    create: { question: "What is your mother's maiden name?" },
  });
  await prisma.securityQuestion.upsert({
    where: { question: 'What city were you born in?' },
    update: {},
    create: { question: 'What city were you born in?' },
  });

  // 7. News Categories
  await prisma.newsCategory.upsert({
    where: { categoryName: 'Politics' },
    update: {},
    create: { categoryName: 'Politics', description: 'Political news and updates' },
  });
  await prisma.newsCategory.upsert({
    where: { categoryName: 'Sports' },
    update: {},
    create: { categoryName: 'Sports', description: 'Sports results and athlete news' },
  });
  await prisma.newsCategory.upsert({
    where: { categoryName: 'Technology' },
    update: {},
    create: { categoryName: 'Technology', description: 'Hardware, software, web, and scientific developments' },
  });
  await prisma.newsCategory.upsert({
    where: { categoryName: 'Health' },
    update: {},
    create: { categoryName: 'Health', description: 'Wellness, medical developments, and diseases' },
  });
  await prisma.newsCategory.upsert({
    where: { categoryName: 'Business' },
    update: {},
    create: { categoryName: 'Business', description: 'Finance, economics, and corporate news' },
  });

  // 8. Languages
  const langEn = await prisma.language.upsert({
    where: { languageName: 'English' },
    update: {},
    create: { languageName: 'English' },
  });
  await prisma.language.upsert({
    where: { languageName: 'Spanish' },
    update: {},
    create: { languageName: 'Spanish' },
  });

  // 9. Embedding Models
  const modelEmb = await prisma.embeddingModel.upsert({
    where: { modelName: 'text-embedding-3-small' },
    update: {},
    create: {
      modelName: 'text-embedding-3-small',
      modelVersion: 'v3',
      embeddingDimension: 1536,
      status: 'Active',
    },
  });

  // 10. LLM Configurations
  const llmConf = await prisma.lLMConfiguration.upsert({
    where: { modelName: 'gemini-2.5-flash' },
    update: {},
    create: {
      modelName: 'gemini-2.5-flash',
      provider: 'Google',
      modelVersion: 'v2.5',
      temperature: 0.2,
      maximumTokens: 4096,
      status: 'Active',
    },
  });

  // 11. Similarity Thresholds
  const th1 = await prisma.similarityThreshold.upsert({
    where: { thresholdId: 1 },
    update: {},
    create: {
      thresholdId: 1,
      minimumSimilarityScore: 0.80,
      maximumSimilarityScore: 1.00,
      confidenceLevel: 'High',
    },
  });
  await prisma.similarityThreshold.upsert({
    where: { thresholdId: 2 },
    update: {},
    create: {
      thresholdId: 2,
      minimumSimilarityScore: 0.50,
      maximumSimilarityScore: 0.79,
      confidenceLevel: 'Medium',
    },
  });
  await prisma.similarityThreshold.upsert({
    where: { thresholdId: 3 },
    update: {},
    create: {
      thresholdId: 3,
      minimumSimilarityScore: 0.00,
      maximumSimilarityScore: 0.49,
      confidenceLevel: 'Low',
    },
  });

  // 12. Feedback Types
  await prisma.feedbackType.upsert({
    where: { feedbackTypeName: 'Incorrect Result' },
    update: {},
    create: { feedbackTypeName: 'Incorrect Result', description: 'The verification result classified the article wrongly.' },
  });
  await prisma.feedbackType.upsert({
    where: { feedbackTypeName: 'Unclear Explanation' },
    update: {},
    create: { feedbackTypeName: 'Unclear Explanation', description: 'The AI explanation was confusing or insufficient.' },
  });
  await prisma.feedbackType.upsert({
    where: { feedbackTypeName: 'Suggestions' },
    update: {},
    create: { feedbackTypeName: 'Suggestions', description: 'Feature suggestions or UI improvements.' },
  });

  // 13. Report Types
  await prisma.reportType.upsert({
    where: { reportName: 'Daily Verification Report' },
    update: {},
    create: { reportName: 'Daily Verification Report', description: 'Verification results generated today.' },
  });
  await prisma.reportType.upsert({
    where: { reportName: 'Monthly Fake News Analysis' },
    update: {},
    create: { reportName: 'Monthly Fake News Analysis', description: 'Trends in fake vs real news articles.' },
  });
  await prisma.reportType.upsert({
    where: { reportName: 'User Activity Report' },
    update: {},
    create: { reportName: 'User Activity Report', description: 'User login counts and profile modifications.' },
  });

  // 14. News Sources
  const srcBBC = await prisma.newsSource.upsert({
    where: { sourceName: 'BBC News' },
    update: {},
    create: {
      sourceName: 'BBC News',
      sourceType: 'Mainstream',
      websiteURL: 'https://www.bbc.com',
      country: 'United Kingdom',
      language: 'English',
      status: 'Active',
    },
  });
  await prisma.newsSource.upsert({
    where: { sourceName: 'Times of India' },
    update: {},
    create: {
      sourceName: 'Times of India',
      sourceType: 'Mainstream',
      websiteURL: 'https://timesofindia.indiatimes.com',
      country: 'India',
      language: 'English',
      status: 'Active',
    },
  });

  // 15. Trusted News Sources (Evidence suppliers)
  await prisma.trustedNewsSource.upsert({
    where: { sourceName: 'BBC News' },
    update: {},
    create: {
      sourceName: 'BBC News',
      websiteURL: 'https://www.bbc.com',
      country: 'United Kingdom',
      language: 'English',
      sourceType: 'Mainstream',
      reliabilityScore: 97.5,
      status: 'Active',
    },
  });
  await prisma.trustedNewsSource.upsert({
    where: { sourceName: 'Reuters' },
    update: {},
    create: {
      sourceName: 'Reuters',
      websiteURL: 'https://www.reuters.com',
      country: 'United Kingdom',
      language: 'English',
      sourceType: 'News Agency',
      reliabilityScore: 99.0,
      status: 'Active',
    },
  });
  await prisma.trustedNewsSource.upsert({
    where: { sourceName: 'Times of India' },
    update: {},
    create: {
      sourceName: 'Times of India',
      websiteURL: 'https://timesofindia.indiatimes.com',
      country: 'India',
      language: 'English',
      sourceType: 'Mainstream',
      reliabilityScore: 93.0,
      status: 'Active',
    },
  });

  // 16. Vector Database Config
  await prisma.vectorDatabase.upsert({
    where: { collectionName: 'news_evidence_vectors' },
    update: {},
    create: {
      collectionName: 'news_evidence_vectors',
      embeddingModel: 'text-embedding-3-small',
      vectorDimension: 1536,
      similarityMetric: 'cosine',
      status: 'Connected',
    },
  });

  // 17. API Configurations
  await prisma.aPIConfiguration.upsert({
    where: { apiName: 'NewsAPI' },
    update: {},
    create: {
      apiName: 'NewsAPI',
      apiKey: 'mock_key',
      baseURL: 'https://newsapi.org/v2',
      requestLimit: 1000,
      refreshInterval: 60,
      status: 'Active',
    },
  });

  // Create default admin user
  const adminEmail = 'admin@fakenewsdetection.com';
  const hashedPassword = await bcrypt.hash('adminPassword123!', 10);

  /*
   * Security answers are password-equivalent secrets and must be hashed with
   * the same normalisation the login path uses, or the seeded admin can never
   * reset their password. The registration route was fixed for this; the seed
   * still wrote the answer in readable form.
   */
  const hashedSecurityAnswer = await bcrypt.hash(normaliseSecurityAnswer('Hyderabad'), 10);
  
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      firstName: 'Admin',
      lastName: 'User',
      email: adminEmail,
      password: hashedPassword,
      mobileNumber: '9876543210',
      countryId: india.countryId,
      stateId: telangana.stateId,
      cityId: hyderabad.cityId,
      roleId: adminRole.roleId,
      statusId: statusActive.statusId,
      securityQuestionId: sq1.securityQuestionId,
      securityAnswer: hashedSecurityAnswer,
    },
  });

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
