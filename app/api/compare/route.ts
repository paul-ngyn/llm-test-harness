import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { SUITE_TEMPLATES } from "@/lib/templates";
import { runComparison } from "@/lib/runner";
import { listComparisons } from "@/lib/storage";

// Synchronous execution, mirroring /api/suites/[id]/run — fine for small suites.
export const maxDuration = 300;

export async function GET() {
  return NextResponse.json(await listComparisons());
}

// Runs a premade template's cases against several models in parallel and
// persists the side-by-side result.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const template = SUITE_TEMPLATES.find((t) => t.id === body.templateId);
  if (!template) {
    return NextResponse.json({ error: "Unknown template" }, { status: 404 });
  }

  const models: string[] = Array.isArray(body.models) ? body.models : [];
  if (models.length < 2) {
    return NextResponse.json(
      { error: "Select at least two models to compare" },
      { status: 400 }
    );
  }

  const cases = template.cases.map((c) => ({ ...c, id: randomUUID() }));
  const comparison = await runComparison(template.name, template.systemPrompt, cases, models);
  return NextResponse.json(comparison, { status: 201 });
}
