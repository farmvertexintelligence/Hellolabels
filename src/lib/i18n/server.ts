import "server-only";
import { cookies } from "next/headers";
import { DICTS, LANG_COOKIE, isLang, type Lang } from "./dict";

export async function getLang(): Promise<Lang> {
  const c = (await cookies()).get(LANG_COOKIE)?.value;
  return isLang(c) ? c : "en";
}

export async function getDict() {
  const lang = await getLang();
  return { lang, t: DICTS[lang] };
}
