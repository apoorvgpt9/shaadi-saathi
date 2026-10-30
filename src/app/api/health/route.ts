// GET /api/health: liveness probe for deployment checks.
export function GET() {
  return Response.json({ status: "ok" });
}
