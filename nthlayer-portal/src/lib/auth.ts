// Polyfill crypto.randomBytes for Cloudflare Workers (unenv doesn't implement fs.readdir)
if (typeof globalThis !== "undefined" && typeof (globalThis as Record<string, unknown>).crypto === "object") {
  const nodeCrypto = globalThis as unknown as { crypto: Record<string, unknown> };
  if (typeof nodeCrypto.crypto.randomBytes !== "function") {
    nodeCrypto.crypto.randomBytes = (size: number): Buffer => {
      const bytes = new Uint8Array(size);
      globalThis.crypto.getRandomValues(bytes);
      return Buffer.from(bytes);
    };
  }
}
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "./db";

function getSecret() {
  return new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret-change-me");
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createToken(userId: string): Promise<string> {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as { userId: string };
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload) return null;

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, name: true, role: true, systemRole: true, company: true, jobTitle: true, planId: true },
  });
  return user;
}
