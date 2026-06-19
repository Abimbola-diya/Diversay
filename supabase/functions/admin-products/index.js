import { withSupabase } from "@supabase/server"

export default {
  fetch: withSupabase({ auth: "secret" }, async (_req, ctx) => {
    const { data, error } = await ctx.supabaseAdmin
      .from("products")
      .select("id, name, category, default_unit, unit_price, created_at")
      .order("created_at", { ascending: false })

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ data })
  }),
}