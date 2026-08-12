import { NextRequest, NextResponse } from "next/server";
import { checkSameOrigin } from "@/lib/security/same-origin";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 2_048;
// Positions are numeric(28,8), so a sale is quantified to eight decimals.
// Four, as the buy path uses for EAG, would round a holding up as often as
// down and make closing a position outright impossible.
const SHARE_SCALE = 100_000_000;

type SellRequest = {
  marketId?: unknown;
  shares?: unknown;
  outcome?: unknown;
  idempotencyKey?: unknown;
  minProceeds?: unknown;
};

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

async function readBoundedJson(request: NextRequest): Promise<SellRequest> {
  if (!request.body) throw new Error("EMPTY_BODY");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_BODY_BYTES) throw new Error("BODY_TOO_LARGE");
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as SellRequest;
}

export async function POST(request: NextRequest) {
  const originFailure = checkSameOrigin(request);
  if (originFailure) {
    return errorResponse(originFailure.message, originFailure.status);
  }

  const mediaType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (mediaType !== "application/json") {
    return errorResponse("Content-Type must be application/json.", 415);
  }

  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);
    if (!Number.isSafeInteger(contentLength) || contentLength < 0) {
      return errorResponse("Invalid Content-Length header.", 400);
    }
    if (contentLength > MAX_BODY_BYTES) return errorResponse("Request body is too large.", 413);
  }

  let body: SellRequest;
  try {
    body = await readBoundedJson(request);
  } catch (error) {
    if (error instanceof Error && error.message === "BODY_TOO_LARGE") {
      return errorResponse("Request body is too large.", 413);
    }
    return errorResponse("Invalid JSON request.", 400);
  }

  const { marketId, shares, outcome, idempotencyKey, minProceeds } = body;

  if (!Number.isSafeInteger(marketId) || Number(marketId) <= 0) {
    return errorResponse("Invalid market.", 400);
  }
  if (
    typeof shares !== "number" ||
    !Number.isFinite(shares) ||
    shares <= 0 ||
    Math.abs(shares * SHARE_SCALE - Math.round(shares * SHARE_SCALE)) > 1e-3
  ) {
    return errorResponse("Shares must be positive with at most eight decimals.", 400);
  }
  if (outcome !== "yes" && outcome !== "no") {
    return errorResponse("Outcome must be yes or no.", 400);
  }
  if (typeof idempotencyKey !== "string" || !UUID_PATTERN.test(idempotencyKey)) {
    return errorResponse("Invalid idempotency key.", 400);
  }
  if (
    minProceeds !== undefined &&
    minProceeds !== null &&
    (typeof minProceeds !== "number" || !Number.isFinite(minProceeds) || minProceeds < 0)
  ) {
    return errorResponse("Invalid minimum proceeds.", 400);
  }

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return errorResponse("Authentication required.", 401);
  }

  const { data, error } = await supabase.rpc("submit_sell", {
    p_market_id: Number(marketId),
    p_shares: shares,
    p_outcome: outcome,
    p_idempotency_key: idempotencyKey,
    p_min_proceeds: minProceeds ?? undefined,
  });

  if (error) {
    const message = error.message;
    if (message.startsWith("Too many trades")) return errorResponse(message, 429);
    if (message.startsWith("Price moved")) return errorResponse(message, 409);
    if (message === "Authentication required" || message === "Account is not active") {
      return errorResponse("You are not allowed to trade.", 403);
    }
    if (
      message.startsWith("You do not hold") ||
      message.startsWith("You only hold") ||
      message.startsWith("Market") ||
      message.startsWith("Sell amount") ||
      message.startsWith("Sale") ||
      message.startsWith("Outcome")
    ) {
      return errorResponse(message, 400);
    }
    console.error("Sell execution failed", { code: error.code, message: error.message });
    return errorResponse("The sale could not be completed. Please try again.", 500);
  }

  const sale = data?.[0];
  if (!sale) return errorResponse("The sale did not return a result.", 500);

  return NextResponse.json(sale, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
