import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

interface RevalidateBody {
  secret: string;
  paths: string[];
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as RevalidateBody;

  if (body.secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  for (const path of body.paths) {
    revalidatePath(path);
  }

  return NextResponse.json({ revalidated: true });
}
