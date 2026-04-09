import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;

  const report = await db.report.findFirst({
    where: { scan: { id, userId: user.id } },
    orderBy: { version: "desc" },
  });

  if (!report) return new Response("Report not found", { status: 404 });

  // Inject auto-print script before </body>
  const printScript = `<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},400);});</script>`;
  const html = report.htmlContent.replace("</body>", `${printScript}</body>`);

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Frame-Options": "SAMEORIGIN",
    },
  });
}
