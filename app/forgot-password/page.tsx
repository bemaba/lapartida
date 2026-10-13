"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { ChefHat, ArrowLeft } from "lucide-react";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!url || !key) { setError("El servicio no está configurado."); return; }
    setBusy(true); setError("");
    const supabase = createClient(url, key);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (resetError) setError("No se ha podido enviar el correo. Inténtalo de nuevo más tarde.");
    else setSent(true);
    setBusy(false);
  };
  return <main className="lp-center"><section className="lp-card lp-login">
    <div className="lp-logo"><ChefHat size={26}/></div><div className="lp-kicker">RECUPERAR ACCESO</div>
    <h1>¿Has olvidado tu contraseña?</h1>
    {sent ? <p className="lp-muted">Si el correo está asociado a una cuenta, recibirás un enlace para crear una contraseña nueva. Revisa también la carpeta de spam.</p> : <>
      <p className="lp-muted">Te enviaremos un enlace seguro para restablecerla.</p>
      <form onSubmit={submit} className="lp-form"><label>Correo electrónico<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@correo.com"/></label><button className="lp-button lp-primary" disabled={busy}>{busy ? "Enviando…" : "Enviar enlace"}</button></form>
      {error && <p className="lp-notice">{error}</p>}
    </>}
    <Link href="/" className="lp-back-link"><ArrowLeft size={15}/> Volver al inicio de sesión</Link>
  </section></main>;
}
