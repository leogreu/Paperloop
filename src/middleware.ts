import { defineMiddleware } from "astro:middleware";
import { supabase } from "./lib/supabase";

export const onRequest = defineMiddleware(async (context, next) => {
    const accessToken = context.cookies.get("sb-access-token");
    const refreshToken = context.cookies.get("sb-refresh-token");

    if (accessToken && refreshToken) {
        const { data, error } = await supabase.auth.setSession({
            refresh_token: refreshToken.value,
            access_token: accessToken.value,
        });

        if (!error) {
            context.locals.user = data.user;
        }
    }

    return next();
});
