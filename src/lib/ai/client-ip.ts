// Identifies the calling client from proxy headers, for rate limiting.

/**
 * The caller's address: `x-real-ip`, else the first `x-forwarded-for` entry, else "unknown". Empty
 * values are skipped.
 */
export function clientIp(request: Request): string {
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  const forwardedIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwardedIp) {
    return forwardedIp;
  }

  return "unknown";
}
