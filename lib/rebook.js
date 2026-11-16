// Rebooked return parcels: when TCS returns a parcel the app re-ships it as a NEW order in the same store, tagged
// "rebooked" + "rebook-of:#<original>" with the note "Rebooked from #<original> (returned by TCS)".
// The original order was already counted as a sale on its own day, so the copy must not count again.
// Used by the sales report code only (lib/sales.js, lib/herbs.js feed). Read-only: nothing here changes Shopify or TCS.
const tagsOf = (o) => (Array.isArray(o && o.tags) ? o.tags : []).map((t) => String(t).trim());
const noteOf = (o) => String((o && o.note) || "").trim();

export function isRebooked(o) {
  return tagsOf(o).some((t) => /^rebooked$/i.test(t) || /^rebook-of:/i.test(t)) || /^Rebooked from #/i.test(noteOf(o));
}

// "52111" for tag rebook-of:#52111, else from the note, else null
export function rebookOf(o) {
  for (const t of tagsOf(o)) { const m = /^rebook-of:\s*#?\s*(\d+)/i.exec(t); if (m) return m[1]; }
  const m = /^Rebooked from #(\d+)/i.exec(noteOf(o));
  return m ? m[1] : null;
}
