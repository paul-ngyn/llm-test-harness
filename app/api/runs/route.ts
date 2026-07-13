import { NextRequest, NextResponse } from "next/server";
import { listRuns } from "@/lib/storage";

export async function GET(req: NextRequest) {
  const suiteId = req.nextUrl.searchParams.get("suiteId") ?? undefined;
  return NextResponse.json(await listRuns(suiteId));
}
