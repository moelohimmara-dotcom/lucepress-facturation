const PRINT_FRAME_ID = "lucepress-print-frame";

export interface PrintDocumentFooter {
  slogan: string;
  legalLine: string;
}

export interface PrintDocumentOptions {
  filename: string;
  footer: PrintDocumentFooter;
}

export async function printDocumentToPdf(sourceElementId: string, options: PrintDocumentOptions): Promise<void> {
  const source = document.getElementById(sourceElementId);
  if (!source) throw new Error("Le document à imprimer est introuvable.");

  const html = await captureDocumentHtml(sourceElementId, options);

  await printHtml(html, options.filename);
}

/**
 * Capture le DOM rendu par l'app (composant React résolu : classes Tailwind +
 * styles inline) et renvoie un document HTML complet, autonome et imprimable.
 * Utilisé pour envoyer le vrai rendu de l'app au moteur PDF serveur (PDFShift),
 * garantissant un PDF identique à l'aperçu.
 */
export async function captureDocumentHtml(sourceElementId: string, options: PrintDocumentOptions): Promise<string> {
  const source = document.getElementById(sourceElementId);
  if (!source) throw new Error("Le document à capturer est introuvable.");

  const clone = source.cloneNode(true) as HTMLElement;
  clone.removeAttribute("id");
  clone.classList.add("print-document-root");

  const css = await collectPrintableStylesheets();

  return buildPrintDocument(clone.outerHTML, css, options);
}

async function collectPrintableStylesheets(): Promise<string> {
  const sheets: string[] = [];
  for (const node of Array.from(document.styleSheets)) {
    try {
      const href = node.href;
      if (href) {
        const res = await fetch(href);
        if (res.ok) sheets.push(await res.text());
        continue;
      }
      if (node.cssRules) {
        const text = Array.from(node.cssRules).map((r) => r.cssText).join("\n");
        if (text) sheets.push(text);
      }
    } catch {
      // cross-origin stylesheet without CORS: skip, styles are inlined in the clone via Tailwind
    }
  }
  return sheets.join("\n\n");
}

function buildPrintDocument(bodyInnerHtml: string, css: string, options: PrintDocumentOptions): string {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>${escapeHtml(options.filename)}</title>
<style>
${css}

/* ===== Print-specific layout (A4, footer ancré, pagination) ===== */
@page {
  size: A4;
  margin: 14mm 12mm 22mm 12mm;
}
* { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
html, body {
  margin: 0 !important;
  padding: 0 !important;
  background: #fff !important;
  color: #243530;
}
body { font-family: "Outfit", system-ui, sans-serif; }

.print-document-root {
  width: 100% !important;
  max-width: 100% !important;
  margin: 0 !important;
  border: 0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  overflow: visible !important;
}
.print-document-root > div:first-child {
  border-radius: 0 !important;
  /* hero: keep gradient, remove card rounding, span full page width */
  margin: 0 -12mm 0 -12mm;
  padding-left: 12mm !important;
  padding-right: 12mm !important;
}

/* Footer ancré en bas de CHAQUE page imprimée (position: fixed) */
.print-doc-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  margin: 0 -12mm;
  padding: 7mm 12mm 6mm;
  background: #e8f2ee;
  border-top: 1px solid #e4ddcb;
  text-align: center;
  z-index: 999;
  font-family: "Outfit", system-ui, sans-serif;
}
.print-doc-footer .accent {
  width: 48px; height: 3px; background: #d4a24e; border-radius: 2px; margin: 0 auto 10px;
}
.print-doc-footer .slogan {
  font-style: italic; font-weight: 500; font-size: 13px; color: #153f38; margin: 0 0 6px;
  font-family: "Fraunces", Georgia, serif;
}
.print-doc-footer .legal { font-size: 10px; color: #4a5752; line-height: 1.6; margin: 0; }

/* Hide the in-flow footer of the clone in print; the fixed footer below replaces it on every page */
.print-document-root footer { display: none !important; }

/* Avoid breaking a table row across pages */
tr, .print-keep-together { break-inside: avoid; page-break-inside: avoid; }
thead { display: table-header-group; }

@media screen {
  body { background: #f4ede0; padding: 24px; }
  .print-document-root { max-width: 210mm; margin: 0 auto !important; border: 1px solid #e4ddcb; border-radius: 16px; overflow: hidden; box-shadow: 0 18px 50px -28px rgba(17,59,53,.32); }
}
</style>
</head>
<body>
${bodyInnerHtml}
<div class="print-doc-footer" aria-hidden="true">
  <div class="accent"></div>
  <p class="slogan">${escapeHtml(options.footer.slogan)}</p>
  <p class="legal">${escapeHtml(options.footer.legalLine)}</p>
</div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function printHtml(html: string, filename: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(PRINT_FRAME_ID);
    if (existing) existing.remove();

    const frame = document.createElement("iframe");
    frame.id = PRINT_FRAME_ID;
    frame.style.position = "fixed";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "0";
    frame.setAttribute("aria-hidden", "true");
    frame.setAttribute("title", filename);

    const cleanup = () => {
      window.setTimeout(() => frame.remove(), 1000);
    };

    frame.onload = () => {
      try {
        const doc = frame.contentWindow?.document;
        if (!doc) throw new Error("Frame non accessible.");
        doc.open();
        doc.write(html);
        doc.close();
        const win = frame.contentWindow;
        if (!win) throw new Error("Fenêtre d'impression non accessible.");
        const afterPrint = () => {
          win.removeEventListener("afterprint", afterPrint);
          cleanup();
          resolve();
        };
        win.addEventListener("afterprint", afterPrint);
        win.focus();
        win.print();
        // Fallback resolve if afterprint does not fire (some browsers)
        window.setTimeout(() => { cleanup(); resolve(); }, 60000);
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    document.body.appendChild(frame);
  });
}
