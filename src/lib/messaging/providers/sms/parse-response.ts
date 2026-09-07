export type ParsedSmsSuccess = {
  success: true;
  units: number;
  providerMessageId: string;
};

export type ParsedSmsFailure = {
  success: false;
  statusCode: number;
};

export type ParsedSmsResponse = ParsedSmsSuccess | ParsedSmsFailure;

export type ParseLegacySmsResponseOptions = {
  successStatusCode?: number;
};

export function parseLegacySmsResponse(
  raw: string,
  options: ParseLegacySmsResponseOptions = {},
): ParsedSmsResponse {
  const trimmed = raw.trim();
  const successStatusCode = options.successStatusCode ?? 1;

  if (!trimmed) {
    return { success: false, statusCode: -1 };
  }

  const parts = trimmed.split("|").map((part) => part.trim());
  const statusCode = Number.parseInt(parts[0] ?? "", 10);

  if (!Number.isInteger(statusCode)) {
    return { success: false, statusCode: -1 };
  }

  if (statusCode !== successStatusCode) {
    return { success: false, statusCode };
  }

  const units = Number.parseInt(parts[1] ?? "", 10);
  const providerMessageId = parts[2] ?? "";

  if (!Number.isInteger(units) || units < 0 || !providerMessageId) {
    return { success: false, statusCode: -1 };
  }

  return {
    success: true,
    units,
    providerMessageId,
  };
}

export type ParsedSmsBalanceResponse = {
  valid: boolean;
  invalidCredentials: boolean;
  statusCode: number;
  /** Remaining prepaid credits when the provider includes them (e.g. `1|100` or `1|trans1:5065`). */
  balanceCredits?: number;
};

export type ParseLegacySmsBalanceOptions = {
  /** Prefer balance for this SMS route when the gateway returns `route:credits` pairs. */
  preferredRoute?: string;
};

/**
 * Parses a non-negative credit amount from a balance token.
 * Accepts plain integers (`100`), decimals (`100.5` → 100), and `route:credits`.
 */
function parseBalanceCreditToken(token: string): number | null {
  const trimmed = token.trim();
  if (!trimmed) {
    return null;
  }

  const routeMatch = trimmed.match(/^[^:]+:(\d+(?:\.\d+)?)$/);
  const numericText = routeMatch?.[1] ?? trimmed;
  const value = Number.parseFloat(numericText);

  if (!Number.isFinite(value) || value < 0) {
    return null;
  }

  return Math.floor(value);
}

function extractBalanceCredits(
  payloadParts: string[],
  preferredRoute?: string,
): number | undefined {
  const tokens = payloadParts
    .flatMap((part) => part.split(/[,;]/))
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    return undefined;
  }

  const normalizedRoute = preferredRoute?.trim().toLowerCase();

  if (normalizedRoute) {
    for (const token of tokens) {
      const routePrefix = token.match(/^([^:]+):/);
      if (
        routePrefix &&
        routePrefix[1]!.trim().toLowerCase() === normalizedRoute
      ) {
        const credits = parseBalanceCreditToken(token);
        if (credits !== null) {
          return credits;
        }
      }
    }
  }

  for (const token of tokens) {
    const credits = parseBalanceCreditToken(token);
    if (credits !== null) {
      return credits;
    }
  }

  return undefined;
}

export function parseLegacySmsBalanceResponse(
  raw: string,
  options: ParseLegacySmsBalanceOptions = {},
): ParsedSmsBalanceResponse {
  const trimmed = raw.trim().replace(/^\uFEFF/, "");

  if (!trimmed) {
    return { valid: false, invalidCredentials: false, statusCode: -1 };
  }

  const parts = trimmed.split("|").map((part) => part.trim());
  const statusCode = Number.parseInt(parts[0] ?? "", 10);

  if (!Number.isInteger(statusCode)) {
    return { valid: false, invalidCredentials: false, statusCode: -1 };
  }

  if (statusCode === 1) {
    const balanceCredits = extractBalanceCredits(
      parts.slice(1),
      options.preferredRoute,
    );
    return {
      valid: true,
      invalidCredentials: false,
      statusCode,
      ...(balanceCredits !== undefined ? { balanceCredits } : {}),
    };
  }

  if (statusCode === 2) {
    return { valid: false, invalidCredentials: true, statusCode };
  }

  return { valid: false, invalidCredentials: false, statusCode };
}

export function mapLegacySmsStatusToError(statusCode: number): {
  code: string;
  message: string;
} {
  switch (statusCode) {
    case 2:
      return {
        code: "INVALID_CREDENTIALS",
        message: "Invalid SMS provider credentials",
      };
    case 3:
      return {
        code: "INSUFFICIENT_BALANCE",
        message: "Insufficient SMS provider balance",
      };
    case 4:
      return {
        code: "PROVIDER_ERROR",
        message: "SMS provider returned an error",
      };
    case 5:
      return {
        code: "INVALID_SENDER_ID",
        message: "Invalid SMS sender ID",
      };
    case 6:
      return {
        code: "INVALID_ROUTE",
        message: "Invalid SMS route",
      };
    case 7:
      return {
        code: "SUBMISSION_ERROR",
        message: "SMS provider rejected the submission",
      };
    case 10:
      return {
        code: "MISSING_TEMPLATE_ID",
        message: "SMS DLT template ID is missing",
      };
    default:
      return {
        code: "PROVIDER_ERROR",
        message: "Unknown SMS provider response",
      };
  }
}
