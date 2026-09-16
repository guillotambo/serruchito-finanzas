"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

/**
 * Primitiva única de overlay: `Drawer` (panel lateral) y `Modal` (ventana
 * centrada). Antes cada pantalla se escribía su propio `role="dialog"` a
 * mano — el detalle de posición, el alta de movimiento y el menú mobile
 * tenían tres versiones distintas del mismo backdrop, la misma tecla Escape y
 * el mismo bloqueo de scroll, con accesibilidad desparejo entre ellas.
 *
 * Los dos comparten cuerpo y solo difieren en el contenedor: el chrome
 * (backdrop, header sticky, botón de cerrar) vive una sola vez acá.
 */

function useOverlayChrome(onClose: () => void, focusRef: React.RefObject<HTMLButtonElement | null>) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    focusRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, focusRef]);
}

type OverlayProps = {
  onClose: () => void;
  /**
   * Encabezado del panel. Recibe el id que hay que poner en el título para
   * que `aria-labelledby` apunte a algo real: el id se genera acá porque
   * puede haber dos overlays montados a la vez (detalle + edición).
   */
  header: (titleId: string) => React.ReactNode;
  children: React.ReactNode;
  /** Acciones a la izquierda del botón de cerrar (navegación, editar, borrar). */
  headerActions?: React.ReactNode;
  /** Ancho máximo del panel. Default: 440px en drawer, 480px en modal. */
  maxWidth?: string;
};

export function Drawer({ onClose, header, headerActions, children, maxWidth = "440px" }: OverlayProps) {
  return (
    <OverlayRoot onClose={onClose} className="flex justify-end">
      {(titleId, closeRef) => (
        <aside
          className="ui-drawer relative z-10 h-full w-full overflow-y-auto"
          style={{ maxWidth }}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <OverlayChrome titleId={titleId} closeRef={closeRef} onClose={onClose} header={header} headerActions={headerActions}>
            {children}
          </OverlayChrome>
        </aside>
      )}
    </OverlayRoot>
  );
}

export function Modal({ onClose, header, headerActions, children, maxWidth = "480px" }: OverlayProps) {
  return (
    <OverlayRoot onClose={onClose} className="flex items-start justify-center overflow-y-auto p-4 sm:items-center">
      {(titleId, closeRef) => (
        <div
          className="ui-modal relative z-10 w-full overflow-y-auto sm:max-h-[85vh]"
          style={{ maxWidth }}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <OverlayChrome titleId={titleId} closeRef={closeRef} onClose={onClose} header={header} headerActions={headerActions}>
            {children}
          </OverlayChrome>
        </div>
      )}
    </OverlayRoot>
  );
}

function OverlayRoot({
  onClose,
  className,
  children,
}: {
  onClose: () => void;
  className: string;
  children: (titleId: string, closeRef: React.RefObject<HTMLButtonElement | null>) => React.ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  useOverlayChrome(onClose, closeRef);

  return (
    <div className={`ui-overlay-root fixed inset-0 z-50 ${className}`} role="presentation">
      <button className="ui-overlay-backdrop absolute inset-0" type="button" aria-label="Cerrar" onClick={onClose} />
      {children(titleId, closeRef)}
    </div>
  );
}

function OverlayChrome({
  titleId,
  closeRef,
  onClose,
  header,
  headerActions,
  children,
}: {
  titleId: string;
  closeRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  header: (titleId: string) => React.ReactNode;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <header
        className="sticky top-0 z-10 border-b px-5 py-5 sm:px-7"
        style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}
      >
        <div className="min-w-0 flex items-start justify-between gap-4">
          <div className="min-w-0">{header(titleId)}</div>
          <div className="flex shrink-0 items-center gap-1.5">
            {headerActions}
            <button ref={closeRef} type="button" onClick={onClose} className="icon-button" aria-label="Cerrar">
              <X aria-hidden="true" size={18} />
            </button>
          </div>
        </div>
      </header>
      <div className="px-5 py-6 sm:px-7">{children}</div>
    </>
  );
}
