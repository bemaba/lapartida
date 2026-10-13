"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { ChefHat, ArrowLeft } from "lucide-react";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 10) { setError("La contraseña debe tener al menos 10 caracteres."); return; }
    if (password !== confirm) { setError("Las contraseñas no coinciden."); return; }
    if (!url || !key) { setError("El servicio no está configurado."); return; }
    setBusy(true); setError("");
    const supabase = createClient(url, key);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) setError("El enlace no es válido o ha caducado. Solicita uno nuevo desde el inicio de sesión.");
    else {
      setDone(true);
      await supabase.auth.signOut();
    }
    setBusy(false);
  };
  return <main className="lp-center"><section className="lp-card lp-login">
    <div className="lp-logo"><ChefHat size={26}/></div><div className="lp-kicker">SEGURIDAD DE LA CUENTA</div>
    <h1>Crear contraseña nueva</h1>
    {done ? <><p className="lp-muted">Contraseña actualizada. Ya puedes iniciar sesión con ella.</p><button className="lp-button lp-primary" onClick={() => router.push("/")}>Ir al inicio de sesión</button></> : <>
      <p className="lp-muted">Utiliza al menos 10 caracteres y no reutilices una contraseña de otro servicio.</p>
      <form onSubmit={submit} className="lp-form"><label>Nueva contraseña<input type="password" autoComplete="new-password" minLength={10} required value={password} onChange={e => setPassword(e.target.value)} /></label><label>Repite la contraseña<input type="password" autoComplete="new-password" minLength={10} required value={confirm} onChange={e => setConfirm(e.target.value)} /></label><button className="lp-button lp-primary" disabled={busy}>{busy ? "Guardando…" : "Guardar contraseña"}</button></form>
      {error && <p className="lp-notice">{error}</p>}
    </>}
    <Link href="/" className="lp-back-link"><ArrowLeft size={15}/> Volver al inicio de sesión</Link>
  </section></main>;
}
