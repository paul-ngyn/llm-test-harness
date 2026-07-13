import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { SUITE_TEMPLATES } from "@/lib/templates";
import { createSuite } from "@/lib/storage";
import { Suite } from "@/lib/types";

export async function GET() {
  return NextResponse.json(
    SUITE_TEMPLATES.map(({ id, name, description, cases }) => ({
      id,
      name,
      description,
      caseCount: cases.length,
    }))
  );
}

// Instantiates a premade template into a real, editable suite for a chosen model.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const template = SUITE_TEMPLATES.find((t) => t.id === body.templateId);
  if (!template) {
    return NextResponse.json({ error: "Unknown template" }, { status: 404 });
  }
  if (!body.model) {
    return NextResponse.json({ error: "model is required" }, { status: 400 });
  }

  const suite: Suite = {
    id: randomUUID(),
    name: body.name || template.name,
    description: template.description,
    model: body.model,
    systemPrompt: template.systemPrompt,
    cases: template.cases.map((c) => ({ ...c, id: randomUUID() })),
    createdAt: new Date().toISOString(),
  };
  return NextResponse.json(await createSuite(suite), { status: 201 });
}
