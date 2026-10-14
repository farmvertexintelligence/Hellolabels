import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser, handle } from "@/lib/server/auth";
import { scanPack } from "@/lib/server/driver";

export const POST = handle(async (req: Request) => {
  const user = await apiUser(["driver", "admin"]);
  const { packNo } = z.object({ packNo: z.string().trim().max(40) }).parse(await req.json());
  return NextResponse.json(await scanPack(packNo, user));
});
