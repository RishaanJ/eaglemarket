import { NextRequest, NextResponse } from "next/server";
import { checkSameOrigin } from "@/lib/security/same-origin";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 2_048;

type CashoutRequest = {
  marketId?: unknown;
  idempotencyKey?: unknown;
};

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

async function readBoundedJson(request: NextRequest): Promise<CashoutRequest> {
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

  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as CashoutRequest;
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

  let body: CashoutRequest;
  try {
    body = await readBoundedJson(request);
  } catch (error) {
    if (error instanceof Error && error.message === "BODY_TOO_LARGE") {
      return errorResponse("Request body is too large.", 413);
    }
    return errorResponse("Invalid JSON request.", 400);
  }

  const { marketId, idempotencyKey } = body;
  if (!Number.isSafeInteger(marketId) || Number(marketId) <= 0) {
    return errorResponse("Invalid market.", 400);
  }
  if (typeof idempotencyKey !== "string" || !UUID_PATTERN.test(idempotencyKey)) {
    return errorResponse("Invalid idempotency key.", 400);
  }

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return errorResponse("Authentication required.", 401);
  }

  const { data, error } = await supabase.rpc("submit_cashout", {
    p_market_id: Number(marketId),
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    const message = error.message;
    if (message.startsWith("Too many trades")) return errorResponse(message, 429);
    if (message === "Authentication required" || message === "Account is not active") {
      return errorResponse("You are not allowed to cash out.", 403);
    }
    if (
      message.startsWith("You do not hold") ||
      message.startsWith("You have already") ||
      message.startsWith("Market is not open")
    ) {
      return errorResponse(message, 400);
    }
    console.error("Cashout execution failed", { code: error.code, message: error.message });
    return errorResponse("The cash-out could not be completed. Please try again.", 500);
  }

  const result = data?.[0];
  if (!result) return errorResponse("The cash-out did not return a result.", 500);

  return NextResponse.json(result, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
