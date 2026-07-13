import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { listSuites, createSuite } from "@/lib/storage";
import { Suite, TestCase } from "@/lib/types";

export async function GET() {
  return NextResponse.json(await listSuites());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.name || !body.model) {
    return NextResponse.json(
      { error: "name and model are required" },
      { status: 400 }
    );
  }
  const suite: Suite = {
    id: randomUUID(),
    name: body.name,
    description: body.description || undefined,
    model: body.model,
    systemPrompt: body.systemPrompt || undefined,
    cases: (body.cases ?? []).map(
      (c: Omit<TestCase, "id">): TestCase => ({ ...c, id: randomUUID() })
    ),
    createdAt: new Date().toISOString(),
  };
  return NextResponse.json(await createSuite(suite), { status: 201 });
}
