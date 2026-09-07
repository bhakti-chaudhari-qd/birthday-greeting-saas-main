import { Prisma } from "@prisma/client";

/**
 * Prisma maps DateTime to PostgreSQL `timestamp without time zone` using UTC
 * components. Raw-query Date parameters can be bound in the host local timezone
 * on some platforms, which breaks comparisons like nextAttemptAt / leaseExpiry.
 * Always bind UTC wall-clock strings for SendQueue timestamp filters/updates.
 */
export function utcTimestampSql(date: Date): Prisma.Sql {
  return Prisma.sql`${date.toISOString().slice(0, 23).replace("T", " ")}::timestamp`;
}
