import { createGateway } from "./gateway.mjs";

// Admission verifies the original user JWT in PostgREST; never forward with a
// service-role key. The gateway secret stays exclusively on the server.
Deno.serve(
  createGateway({
    url: Deno.env.get("SUPABASE_URL"),
    publicKey: Deno.env.get("SUPABASE_ANON_KEY"),
    secret: Deno.env.get("POKEDEX_GATEWAY_SECRET"),
    origins: (Deno.env.get("POKEDEX_GATEWAY_ORIGINS") || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  }),
);
