import { NextRequest, NextResponse } from "next/server";
import { getSuite } from "@/lib/storage";
import { runSuite } from "@/lib/runner";

type Params = { params: Promise<{ id: string }> };

// Synchronous execution — fine for small suites. For long suites, move to a
// job queue and poll run status instead.
export const maxDuration = 300;

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const suite = await getSuite(id);
  if (!suite) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (suite.cases.length === 0) {
    return NextResponse.json(
      { error: "Suite has no test cases" },
      { status: 400 }
    );
  }
  const run = await runSuite(suite);
  return NextResponse.json(run, { status: 201 });
}
