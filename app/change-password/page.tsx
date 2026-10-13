"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { ChefHat, ArrowLeft } from "lucide-react";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default function ChangePasswordPage() {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!url || !key) { setReady(true); return; }
    const supabase = createClient(url, key);
    supabase.auth.getSession().then(({ data }) => {
      setSignedIn(Boolean(data.session));
      setReady(true);
    });
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 10) { setError("La contraseña debe tener al menos 10 caracteres."); return; }
    if (password !== confirm) { setError("Las contraseñas no coinciden."); return; }
    if (!url || !key) { setError("El servicio no está configurado."); return; }
    setBusy(true); setError(""); setNotice("");
    const supabase = createClient(url, key);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) setError("No se ha podido cambiar la contraseña. Vuelve a iniciar sesión e inténtalo de nuevo.");
    else { setNotice("Contraseña actualizada correctamente."); setPassword(""); setConfirm(""); }
    setBusy(false);
  };

  return <main className="lp-center"><section className="lp-card lp-login">
    <div className="lp-logo"><ChefHat size={26}/></div><div className="lp-kicker">SEGURIDAD DE LA CUENTA</div>
    <h1>Cambiar contraseña</h1>
    {!ready ? <p className="lp-muted">Comprobando sesión…</p> : !signedIn ? <><p className="lp-muted">Para cambiar tu contraseña, primero inicia sesión.</p><Link href="/" className="lp-button lp-primary lp-link-button">Ir al inicio de sesión</Link></> : <>
      <p className="lp-muted">Elige una contraseña de al menos 10 caracteres que no uses en otros servicios.</p>
      <form onSubmit={submit} className="lp-form"><label>Nueva contraseña<input type="password" autoComplete="new-password" minLength={10} required value={password} onChange={e => setPassword(e.target.value)} /></label><label>Repite la contraseña<input type="password" autoComplete="new-password" minLength={10} required value={confirm} onChange={e => setConfirm(e.target.value)} /></label><button className="lp-button lp-primary" disabled={busy}>{busy ? "Guardando…" : "Guardar contraseña"}</button></form>
      {notice && <p className="lp-success">{notice}</p>}{error && <p className="lp-notice">{error}</p>}
    </>}
    <Link href="/" className="lp-back-link"><ArrowLeft size={15}/> Volver a La Partida</Link>
  </section></main>;
}
