import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

// POST — save or update feedback for a single item
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { outputId, companyId, itemType, itemIndex, itemText, workflowType, feedback } = await req.json();

  if (!outputId || !companyId || !itemType || itemIndex === undefined || !feedback) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const dbAny = db as unknown as Record<string, any>;
  try {
    await dbAny.itemFeedback.upsert({
      where: {
        outputId_itemType_itemIndex_userId: {
          outputId,
          itemType,
          itemIndex,
          userId: user.id,
        },
      },
      update: { feedback, updatedAt: new Date() },
      create: {
        outputId,
        companyId,
        userId: user.id,
        itemType,
        itemIndex,
        itemText: itemText ?? "",
        workflowType: workflowType ?? "",
        feedback,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[item-feedback] upsert failed:", err);
    return NextResponse.json({ error: "Failed to save feedback" }, { status: 500 });
  }
}

// GET — load all feedback for a company (keyed by outputId_itemType_itemIndex)
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get("companyId");
  if (!companyId) return NextResponse.json({ error: "Missing companyId" }, { status: 400 });

  const dbAny = db as unknown as Record<string, any>;
  try {
    const rows = await dbAny.itemFeedback.findMany({
      where: { companyId, userId: user.id },
      select: { outputId: true, itemType: true, itemIndex: true, feedback: true },
    });

    const map: Record<string, string> = {};
    for (const r of rows) {
      map[`${r.outputId}_${r.itemType}_${r.itemIndex}`] = r.feedback;
    }
    return NextResponse.json(map);
  } catch (err) {
    console.error("[item-feedback] GET failed:", err);
    return NextResponse.json({});
  }
}
