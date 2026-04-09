// Node.js Prisma client — used by Trigger.dev tasks (not Cloudflare Workers)
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prismaNode: PrismaClient };

export const db = globalForPrisma.prismaNode ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prismaNode = db;
