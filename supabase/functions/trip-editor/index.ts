import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigin = Deno.env.get("EDITOR_ALLOWED_ORIGIN") || "https://italy-family-2027.halemango35.chatgpt.site";
const cors = { "Access-Control-Allow-Origin": allowedOrigin, "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-editor-token", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const bytes = new TextEncoder();
const encode = (value: Uint8Array | string) => {
  const data = typeof value === "string" ? bytes.encode(value) : value;
  return btoa(String.fromCharCode(...data)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
};
const equal = async (a: string, b: string) => {
  const [left, right] = await Promise.all([a, b].map((value) => crypto.subtle.digest("SHA-256", bytes.encode(value))));
  const x = new Uint8Array(left), y = new Uint8Array(right); let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] || 0) ^ (y[i] || 0);
  return diff === 0;
};
const sign = async (payload: string, secret: string) => {
  const key = await crypto.subtle.importKey("raw", bytes.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return encode(new Uint8Array(await crypto.subtle.sign("HMAC", key, bytes.encode(payload))));
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const password = Deno.env.get("EDITOR_PASSWORD");
  const signingSecret = Deno.env.get("EDITOR_SIGNING_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!password || !signingSecret || !supabaseUrl || !serviceRole) return json({ error: "伺服器尚未完成設定" }, 503);
  const body = await request.json().catch(() => ({}));
  if (body.action === "unlock") {
    if (!(await equal(String(body.password || ""), password))) return json({ error: "密碼不正確" }, 401);
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
    const payload = `${expiresAt}.${crypto.randomUUID()}`;
    return json({ token: `${encode(payload)}.${await sign(payload, signingSecret)}`, expiresAt });
  }
  if (body.action !== "save") return json({ error: "未知操作" }, 400);
  const token = request.headers.get("x-editor-token") || "";
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return json({ error: "編輯權限無效" }, 401);
  const normalized = encodedPayload.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(encodedPayload.length / 4) * 4, "=");
  const payload = new TextDecoder().decode(Uint8Array.from(atob(normalized), (c) => c.charCodeAt(0)));
  if (!(await equal(signature, await sign(payload, signingSecret))) || Number(payload.split(".")[0]) <= Date.now()) return json({ error: "編輯權限已到期" }, 401);
  const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });
  const expected = Number(body.expectedRevision);
  if (expected === 0) {
    const { data, error } = await admin.from("trip_documents").insert({ id: "italy-family-2027", document: body.trip, revision: 1 }).select("document, revision, updated_at").single();
    if (error?.code === "23505") return json({ conflict: true });
    if (error) return json({ error: error.message }, 400);
    return json(data);
  }
  const { data, error } = await admin.from("trip_documents").update({ document: body.trip, revision: expected + 1 }).eq("id", "italy-family-2027").eq("revision", expected).select("document, revision, updated_at").maybeSingle();
  if (error) return json({ error: error.message }, 400);
  return data ? json(data) : json({ conflict: true });
});


