import { createClient, type RealtimeChannel, type Session } from "@supabase/supabase-js";
import type { Trip } from "./model";

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const publishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY)?.trim();

export const cloudConfigured = Boolean(url && publishableKey);
export const supabase = cloudConfigured ? createClient(url!, publishableKey!, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
}) : null;

export type CloudTrip = { trip: Trip; revision: number; updatedAt: string };

export async function sendMagicLink(email: string) {
  if (!supabase) throw new Error("Supabase 尚未設定");
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) throw error;
}

export async function signOut() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function loadCloudTrip(userId: string): Promise<CloudTrip | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from("trip_documents")
    .select("document, revision, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ? { trip: data.document as Trip, revision: data.revision, updatedAt: data.updated_at } : null;
}

export async function createCloudTrip(userId: string, trip: Trip): Promise<CloudTrip> {
  if (!supabase) throw new Error("Supabase 尚未設定");
  const { data, error } = await supabase.from("trip_documents")
    .insert({ user_id: userId, document: trip, revision: 1 })
    .select("document, revision, updated_at")
    .single();
  if (error) throw error;
  return { trip: data.document as Trip, revision: data.revision, updatedAt: data.updated_at };
}

export async function saveCloudTrip(userId: string, trip: Trip, expectedRevision: number): Promise<CloudTrip | null> {
  if (!supabase) throw new Error("Supabase 尚未設定");
  const { data, error } = await supabase.from("trip_documents")
    .update({ document: trip, revision: expectedRevision + 1 })
    .eq("user_id", userId)
    .eq("revision", expectedRevision)
    .select("document, revision, updated_at")
    .maybeSingle();
  if (error) throw error;
  return data ? { trip: data.document as Trip, revision: data.revision, updatedAt: data.updated_at } : null;
}

export function subscribeToCloudTrip(userId: string, onChange: () => void): RealtimeChannel | null {
  if (!supabase) return null;
  return supabase.channel(`trip-${userId}`)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "trip_documents", filter: `user_id=eq.${userId}` }, onChange)
    .subscribe();
}


