import { NextResponse } from "next/server";

export function jsonError(
  message: string,
  status: number,
  details?: unknown,
) {
  return NextResponse.json(
    {
      error: {
        message,
        ...(details ? { details } : {}),
      },
    },
    { status },
  );
}
