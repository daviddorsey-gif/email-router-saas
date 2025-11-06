// src/utils/logger.ts
import { createServerSupabaseClient } from "@/utils/supabase/server";

type LogLevel = "info" | "warn" | "error";

function format(level: LogLevel, msg: string, meta?: Record<string, any>) {
  const ts = new Date().toISOString();
  const base = `[${ts}] [${level.toUpperCase()}] ${msg}`;
  if (!meta) return base;
  return `${base} | ${JSON.stringify(meta)}`;
}

export async function log(level: LogLevel, msg: string, meta?: Record<string, any>) {
  const line = format(level, msg, meta);
  // always print to console
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);

  // for pilot, also persist "error" level to DB
  if (level === "error") {
    try {
      const supabase = createServerSupabaseClient();
      await supabase.from("server_error_log").insert({
        route: meta?.route ?? "unknown",
        context: meta ?? {},
        message: msg,
        stack: meta?.stack ?? null,
      });
    } catch {
      // never throw from logger
    }
  }
}
