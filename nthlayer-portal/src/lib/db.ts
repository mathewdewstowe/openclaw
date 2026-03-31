import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createClient(): PrismaClient {
  // When deployed to Cloudflare, DATABASE_URL should point to Neon
  // The Neon serverless driver works over HTTP, Prisma handles it natively
  // with the driverAdapters preview feature enabled in schema.prisma
  return new PrismaClient();
}

export const db = globalForPrisma.prisma || createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
