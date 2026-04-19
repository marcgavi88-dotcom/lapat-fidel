"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { useI18n } from "@/i18n/provider";

interface Noticia {
  id: string;
  titulo_ca: string;
  titulo_es: string;
  contenido_ca: string;
  contenido_es: string;
  imagen_url: string | null;
  created_at: string;
}

export default function NewsPage() {
  const { t, lang } = useI18n();
  const [noticias, setNoticias] = useState<Noticia[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supa = createSupabaseBrowser();
    supa
      .from("noticias")
      .select("*")
      .eq("publicada", true)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setNoticias(data);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="py-20 text-center text-oliva-600">{t.common.loading}</div>;

  return (
    <div className="py-6">
      <h1 className="serif text-3xl text-terracota-800 md:text-4xl">{t.news.title}</h1>
      <p className="mt-1 text-oliva-700">{t.news.subtitle}</p>

      <div className="mt-8 space-y-5">
        {noticias.length === 0 ? (
          <p className="text-oliva-600">{t.news.noNews}</p>
        ) : (
          noticias.map((n) => (
            <article key={n.id} className="card">
              {n.imagen_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={n.imagen_url} alt="" className="mb-4 w-full rounded-xl object-cover" />
              )}
              <h2 className="serif text-2xl text-terracota-800">
                {lang === "ca" ? n.titulo_ca : n.titulo_es}
              </h2>
              <p className="mt-1 text-xs text-oliva-600">
                {new Date(n.created_at).toLocaleDateString(lang === "ca" ? "ca-ES" : "es-ES")}
              </p>
              <div className="mt-3 whitespace-pre-wrap text-oliva-800">
                {lang === "ca" ? n.contenido_ca : n.contenido_es}
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
