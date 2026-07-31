import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

let prisma: PrismaClient;

if (process.env.VERCEL) {
  // Mock Prisma client on Vercel serverless environment to prevent SQLite binary load crashes
  prisma = new Proxy({} as PrismaClient, {
    get() {
      return () => Promise.resolve(null);
    },
  });
} else {
  if (process.env.NODE_ENV !== "production") {
    if (!global.prismaGlobal) {
      global.prismaGlobal = new PrismaClient();
    }
    prisma = global.prismaGlobal;
  } else {
    prisma = new PrismaClient();
  }
}

export default prisma;
