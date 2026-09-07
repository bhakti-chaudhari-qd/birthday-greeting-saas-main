import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const timestamp = new Date().toISOString();

  try {
    await prisma.$queryRaw`SELECT 1`;

    return Response.json({
      status: "ok",
      version: "0.1.0",
      database: "connected",
      timestamp,
    });
  } catch {
    return Response.json(
      {
        status: "degraded",
        version: "0.1.0",
        database: "disconnected",
        timestamp,
      },
      { status: 503 },
    );
  }
}
