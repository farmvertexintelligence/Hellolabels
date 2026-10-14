"use server";
import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import sharp from "sharp";
import { isValidGstin } from "@/lib/commerce/gst";
import { supabaseAdmin } from "@/lib/supabase/server";
import { apiUser, HttpError } from "../auth";
import { putFile } from "../storage";
import { run, str, paise, type ActionResult } from "./result";

async function approvedDealer() {
  const user = await apiUser(["dealer"]);
  const { data } = await supabaseAdmin().from("dealers").select("*").eq("id", user.id).maybeSingle();
  if (!data || data.status !== "approved") throw new HttpError(403, "Your dealer account is not approved yet");
  return { user, dealer: data };
}

export async function addShop(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const { user, dealer } = await approvedDealer();
    const gstin = str(fd, "gstin").toUpperCase();
    if (gstin && !isValidGstin(gstin)) throw new HttpError(400, "GSTIN is not valid");
    const phone = str(fd, "phone");
    if (!/^[6-9]\d{9}$/.test(phone)) throw new HttpError(400, "Enter a 10-digit mobile number");
    const name = str(fd, "name");
    const address = str(fd, "address");
    if (name.length < 2 || address.length < 10) throw new HttpError(400, "Enter the shop name and full address");
    await supabaseAdmin().from("dealer_shops").insert({ dealer_id: user.id, name, owner_name: str(fd, "owner") || null, phone, address, pincode: str(fd, "pincode") || null, gstin: gstin || null, district_code: dealer.district_code });
    revalidatePath("/dealer");
    return "Shop added";
  });
}

/** Dealers book ad space for advertisers in their own district; an admin approves it. */
export async function requestAd(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const { user, dealer } = await approvedDealer();
    const start = str(fd, "start");
    const end = str(fd, "end");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || end < start) throw new HttpError(400, "Choose valid dates");
    const amount = paise(fd, "amount");
    if (!Number.isFinite(amount) || amount < 0) throw new HttpError(400, "Enter the ad amount");
    const db = supabaseAdmin();
    const { data: adv, error } = await db.from("advertisers").insert({ name: str(fd, "advertiser"), business: str(fd, "business") || null, phone: str(fd, "phone"), created_by: user.id }).select("id").single();
    if (error) throw new Error(error.message);
    let creative: string | null = null;
    const file = fd.get("creative");
    if (file instanceof File && file.size > 0) {
      if (file.size > 10 * 1024 * 1024) throw new HttpError(413, "Creative must be under 10 MB");
      const img = await sharp(Buffer.from(await file.arrayBuffer())).rotate().flatten({ background: "#ffffff" }).jpeg({ quality: 92 }).toBuffer();
      creative = `ads/${dealer.district_code}/${crypto.randomUUID()}.jpg`;
      await putFile("ad-creatives", creative, img, "image/jpeg");
    }
    await db.from("ad_bookings").insert({ district_code: dealer.district_code, advertiser_id: adv.id, dealer_id: user.id, start_date: start, end_date: end, amount_paise: amount, creative_path: creative, created_by: user.id });
    revalidatePath("/dealer");
    return "Ad booking sent for approval";
  });
}
