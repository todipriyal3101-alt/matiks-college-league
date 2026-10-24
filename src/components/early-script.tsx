"use client";

import { LINK_ERROR_LOGIN } from "@/lib/auth/link-error";

// Runs while the HTML is still parsing, before the first paint:
// - Liquid Glass: <html class="refraction"> on Chromium only. Chromium exposes navigator.userAgentData; Safari and
//   Firefox don't, and keep the frosted blur (globals.css "Liquid Glass").
// - A dead Supabase email link with its error in the #hash (src/lib/auth/link-error.ts) goes to /login with the
//   friendly message, and the hash is cleared. The query form is handled on the server.
const CODE = `try{var u=navigator.userAgentData;if(u&&u.brands.some(function(b){return b.brand==="Chromium"}))document.documentElement.classList.add("refraction")}catch(e){}
try{var h=new URLSearchParams(location.hash.slice(1));if(h.has("error_code")||h.has("error_description")){if(location.pathname==="/login"&&new URLSearchParams(location.search).has("error"))history.replaceState(null,"",location.pathname+location.search);else location.replace(${JSON.stringify(LINK_ERROR_LOGIN)})}}catch(e){}`;

/**
 * Rendered once, straight inside <body> in the root layout. Server HTML only: on the client it renders nothing, and
 * React skips the server's <script> when hydrating (stray nodes directly in <body> are allowed), so React never
 * creates a script element itself ("Encountered a script tag…") and the code runs exactly once, without a flash.
 */
export function EarlyScript() {
  if (typeof window !== "undefined") return null;
  return <script dangerouslySetInnerHTML={{ __html: CODE }} />;
}
