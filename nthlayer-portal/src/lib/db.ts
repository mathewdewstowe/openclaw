import type { PrismaClient as PrismaClientType } from "@prisma/client";
import { PrismaNeonHTTP } from "@prisma/adapter-neon";

// Always use WASM client — the Node.js client calls fs.readdir for libssl detection,
// which is not implemented in unenv (Cloudflare Workers). WASM works in both envs.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require("@prisma/client/wasm") as { PrismaClient: typeof PrismaClientType };

function createClient(): PrismaClientType {
  const adapter = new PrismaNeonHTTP(process.env.DATABASE_URL!, {});
  return new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClientType>[0]);
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClientType };

export const db = globalForPrisma.prisma || createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
