import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSuite, updateSuite, deleteSuite } from "@/lib/storage";
import { TestCase } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const suite = await getSuite(id);
  if (!suite) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(suite);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const suite = await getSuite(id);
  if (!suite) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const updated = {
    ...suite,
    name: body.name ?? suite.name,
    description: body.description ?? suite.description,
    model: body.model ?? suite.model,
    systemPrompt: body.systemPrompt ?? suite.systemPrompt,
    cases: body.cases
      ? body.cases.map((c: Partial<TestCase>) => ({
          ...c,
          id: c.id ?? randomUUID(),
        }))
      : suite.cases,
  };
  return NextResponse.json(await updateSuite(updated));
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  await deleteSuite(id);
  return NextResponse.json({ ok: true });
}
