/*
 * BACKEND ONLY. The `server-only` import above makes this a build error if any
 * client component ever imports this module, directly or transitively. That is
 * not theoretical: the UI previously imported `tokenise` from the retrieval
 * module, which shipped the provider stack and the ONNX import path to the
 * browser.
 */
import 'server-only';

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
