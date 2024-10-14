import { supabase } from "@/lib/supabase";
import { createGettingStarted } from "@/utils/content";
import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
    const authCode = url.searchParams.get("code");
    if (!authCode) return redirect("/auth");

    const { data, error } = await supabase.auth.exchangeCodeForSession(authCode);
    if (error) return redirect("/auth");

    const { access_token, refresh_token, user } = data.session;
    cookies.set("sb-access-token", access_token, { path: "/" });
    cookies.set("sb-refresh-token", refresh_token, { path: "/" });

    // If the user was just created, add the getting started document
    if (((new Date().getTime() - new Date(user.created_at).getTime()) / 1000) < 10) {
        await createGettingStarted(user.id);
    }

    return redirect("/docs");
};
