import { useEffect, useMemo, useRef, useState } from 'react';
import { fmtDate, todayISO } from '../lib/format';
import { ALBUMES_FOTOS, uid, type AlbumFoto, type Foto } from '../lib/model';
import { update, useData, useEngine } from '../store';
import { borrarArchivos, enlacesFotos, fotosDisponibles, subirFoto } from '../sync/fotos';
import { useDialogs } from '../ui/dialogs';
import { Segmented } from '../ui/fields';
import { IconChevron, IconTrash, IconUpload } from '../ui/icons';
import { PageHead } from '../ui/layout';

/** Fotos del piso por etapas (antes, durante la obra, después), guardadas en el almacenamiento privado de la nube. */
export function Fotos() {
  const d = useData();
  const eng = useEngine();
  const { confirm, toast } = useDialogs();
  const [album, setAlbum] = useState<AlbumFoto>('antes');
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [subiendo, setSubiendo] = useState<{ hechas: number; total: number } | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const fotos = useMemo(
    () => d.fotos.filter((f) => f.album === album).sort((a, b) => a.fecha.localeCompare(b.fecha)),
    [d.fotos, album],
  );
  const cuenta = (a: AlbumFoto) => d.fotos.filter((f) => f.album === a).length;
  const puedeSubir = fotosDisponibles && !!eng.session && !eng.sandbox;

  // Enlaces temporales de las miniaturas que aún no tenemos
  useEffect(() => {
    const faltan = fotos.map((f) => f.miniatura).filter((r) => !urls[r]);
    if (!faltan.length || !eng.session) return;
    let vivo = true;
    enlacesFotos(faltan)
      .then((u) => vivo && setUrls((x) => ({ ...x, ...u })))
      .catch(() => vivo && toast('No se han podido cargar las fotos', { error: true }));
    return () => {
      vivo = false;
    };
  }, [fotos, urls, eng.session, toast]);

  const subir = async (files: FileList | null) => {
    if (!files?.length) return;
    const lista = [...files];
    setSubiendo({ hechas: 0, total: lista.length });
    let fallos = 0;
    for (const [i, file] of lista.entries()) {
      const id = uid();
      try {
        const r = await subirFoto(file, id);
        // Fecha de la foto si el móvil la da; si no, hoy
        const fecha = file.lastModified ? new Date(file.lastModified).toISOString().slice(0, 10) : todayISO();
        update((x) => {
          x.fotos.push({ id, album, fecha, nota: '', ...r });
        });
      } catch {
        fallos++;
      }
      setSubiendo({ hechas: i + 1, total: lista.length });
    }
    setSubiendo(null);
    if (input.current) input.current.value = '';
    toast(
      fallos
        ? `${lista.length - fallos} de ${lista.length} fotos subidas. Las demás no se han podido leer (prueba con JPG o PNG).`
        : `${lista.length} ${lista.length === 1 ? 'foto subida' : 'fotos subidas'}`,
      { error: fallos > 0 },
    );
  };

  const idx = abierta ? fotos.findIndex((f) => f.id === abierta) : -1;
  const actual = idx >= 0 ? fotos[idx] : null;

  const borrar = async (f: Foto) => {
    const ok = await confirm({ title: 'Borrar esta foto', body: 'Se borra de la app y de la nube. No se puede deshacer.', confirmText: 'Borrar', danger: true });
    if (!ok) return;
    try {
      await borrarArchivos([f.ruta, f.miniatura]);
    } catch {
      toast('No se ha podido borrar de la nube; se quita solo de la lista', { error: true });
    }
    setAbierta(null);
    update((x) => {
      x.fotos = x.fotos.filter((y) => y.id !== f.id);
    });
  };

  return (
    <div className="page">
      <PageHead
        folio="11"
        title="Fotos del piso"
        subtitle="Cómo estaba, cómo va la obra y cómo queda. Se guardan reducidas en tu nube privada: solo las ves tú."
        actions={
          puedeSubir && (
            <>
              <button className="btn primary" onClick={() => input.current?.click()} disabled={!!subiendo}>
                <IconUpload /> {subiendo ? `Subiendo ${subiendo.hechas}/${subiendo.total}…` : 'Subir fotos'}
              </button>
              <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => void subir(e.target.files)} />
            </>
          )
        }
      />

      <div className="fotos-albumes no-print">
        <Segmented
          value={album}
          options={ALBUMES_FOTOS.map((a) => ({ value: a.id, label: `${a.label}${cuenta(a.id) ? ` · ${cuenta(a.id)}` : ''}` }))}
          onChange={setAlbum}
          ariaLabel="Álbum"
        />
      </div>

      {!fotosDisponibles ? (
        <div className="empty">Las fotos se guardan en la nube y no están disponibles en esta versión.</div>
      ) : !eng.session ? (
        <div className="empty">Inicia sesión en «Copia y ajustes» para ver y subir las fotos.</div>
      ) : fotos.length === 0 ? (
        <div className="empty invite">
          <b>Aún no hay fotos en «{ALBUMES_FOTOS.find((a) => a.id === album)!.label}»</b>
          <span>Sube las que tengas desde el móvil o el ordenador. Se reducen solas para que no ocupen mucho.</span>
          {puedeSubir && (
            <button className="btn primary" onClick={() => input.current?.click()}>
              <IconUpload /> Subir fotos
            </button>
          )}
        </div>
      ) : (
        <ul className="fotos-grid">
          {fotos.map((f) => (
            <li key={f.id}>
              <button type="button" onClick={() => setAbierta(f.id)} aria-label={`Ver foto${f.nota ? `: ${f.nota}` : ''}`}>
                {urls[f.miniatura] ? <img src={urls[f.miniatura]} alt={f.nota || 'Foto del piso'} loading="lazy" /> : <span className="fotos-ph" />}
                {f.nota && <span className="fotos-nota">{f.nota}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {actual && (
        <Visor
          foto={actual}
          anterior={idx > 0 ? () => setAbierta(fotos[idx - 1].id) : undefined}
          siguiente={idx < fotos.length - 1 ? () => setAbierta(fotos[idx + 1].id) : undefined}
          cerrar={() => setAbierta(null)}
          borrar={() => void borrar(actual)}
        />
      )}
    </div>
  );
}

function Visor({
  foto, anterior, siguiente, cerrar, borrar,
}: { foto: Foto; anterior?: () => void; siguiente?: () => void; cerrar: () => void; borrar: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [nota, setNota] = useState(foto.nota);

  useEffect(() => {
    let vivo = true;
    setUrl(null);
    setNota(foto.nota);
    enlacesFotos([foto.ruta]).then((u) => vivo && setUrl(u[foto.ruta] ?? null)).catch(() => {});
    return () => {
      vivo = false;
    };
  }, [foto.id, foto.ruta, foto.nota]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar();
      if (e.key === 'ArrowLeft') anterior?.();
      if (e.key === 'ArrowRight') siguiente?.();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [anterior, siguiente, cerrar]);

  const guardarNota = () => {
    if (nota.trim() === foto.nota) return;
    update((x) => {
      const f = x.fotos.find((y) => y.id === foto.id);
      if (f) f.nota = nota.trim();
    });
  };
  const moverA = (album: AlbumFoto) =>
    update((x) => {
      const f = x.fotos.find((y) => y.id === foto.id);
      if (f) f.album = album;
    });

  return (
    <div className="scrim visor" onMouseDown={(e) => e.target === e.currentTarget && cerrar()}>
      <figure className="visor-fig" role="dialog" aria-modal="true" aria-label="Foto">
        <div className="visor-img" style={{ aspectRatio: `${foto.ancho} / ${foto.alto}` }}>
          {url ? <img src={url} alt={foto.nota || 'Foto del piso'} /> : <span className="fotos-ph" />}
          {anterior && (
            <button className="visor-nav prev" onClick={anterior} aria-label="Foto anterior">
              <IconChevron dir="left" />
            </button>
          )}
          {siguiente && (
            <button className="visor-nav next" onClick={siguiente} aria-label="Foto siguiente">
              <IconChevron />
            </button>
          )}
        </div>
        <figcaption>
          <input
            className="input"
            value={nota}
            placeholder="Añade una nota (cocina, baño…)"
            onChange={(e) => setNota(e.target.value)}
            onBlur={guardarNota}
            onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
            aria-label="Nota de la foto"
          />
          <div className="visor-pie">
            <span className="muted">{foto.fecha ? fmtDate(foto.fecha) : ''}</span>
            <select
              className="input"
              value={foto.album}
              onChange={(e) => moverA(e.target.value as AlbumFoto)}
              aria-label="Álbum de la foto"
            >
              {ALBUMES_FOTOS.map((a) => (
                <option key={a.id} value={a.id}>{a.label}</option>
              ))}
            </select>
            <button className="icon-btn" onClick={borrar} aria-label="Borrar foto">
              <IconTrash />
            </button>
            <button className="btn" onClick={() => (guardarNota(), cerrar())}>Cerrar</button>
          </div>
        </figcaption>
      </figure>
    </div>
  );
}
