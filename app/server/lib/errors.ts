export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class NotFoundError extends ApiError {
  constructor(message = "Not found") {
    super(404, message);
  }
}

export class BadRequestError extends ApiError {
  constructor(message = "Bad request") {
    super(400, message);
  }
}

function isRpcRateLimit(error: unknown): boolean {
  return error instanceof Error && /\b429\b/.test(error.message);
}

export function toErrorResponse(error: unknown): { status: number; body: { error: string } } {
  if (error instanceof ApiError) {
    return { status: error.status, body: { error: error.message } };
  }
  // The devnet public RPC (api.devnet.solana.com) rate-limits aggressively — surface that as
  // a distinct, actionable 503 instead of letting it fall into the generic 500 below, which
  // told the client nothing beyond "Internal server error" (see the "500" reports while
  // testing against devnet).
  if (isRpcRateLimit(error)) {
    console.error("RPC rate-limited:", error);
    return {
      status: 503,
      body: { error: "Devnet RPC is rate-limited right now — please wait a moment and retry." },
    };
  }
  // Unexpected (non-ApiError) failures were being swallowed into a bare "Internal server
  // error" with nothing in the server logs to diagnose from — log the real cause server-side
  // while still keeping the client-facing message generic (don't leak internals in the body).
  console.error("Unhandled error in API route:", error);
  return { status: 500, body: { error: "Internal server error" } };
}
