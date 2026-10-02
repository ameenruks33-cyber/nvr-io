/** Local keys that hold no customer data and are needed for update prompts. */
const KEEP_LOCAL_KEYS = new Set(['nvr_app_version', 'nvr_notify_asked']);

/** Remove everything this app stored on the device (session, unlocks, cached pages). */
export function wipeLocalTraces() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.clear();
  } catch {
    /* storage blocked */
  }
  try {
    for (const key of Object.keys(localStorage)) {
      if (!KEEP_LOCAL_KEYS.has(key)) localStorage.removeItem(key);
    }
  } catch {
    /* storage blocked */
  }
  if ('caches' in window) {
    void caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .catch(() => undefined);
  }
}

function isPhone() {
  return (
    typeof navigator !== 'undefined' &&
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  );
}

/**
 * Rebuilds a receipt link from its phone number and text, accepting only wa.me links.
 * On phones it hands off straight to the WhatsApp app instead of a wa.me web page
 * (which would put the customer name and amount in browser history).
 */
function parseWaMe(link: string): { phone: string; text: string } | null {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return null;
  }
  const phone = url.pathname.replace(/^\//, '');
  if (url.protocol !== 'https:' || url.hostname !== 'wa.me' || !/^\d{6,15}$/.test(phone)) {
    return null;
  }
  return { phone, text: encodeURIComponent(url.searchParams.get('text') || '') };
}

export function privateWhatsAppLink(link: string): string | null {
  const wa = parseWaMe(link);
  if (!wa) return null;
  return isPhone()
    ? `whatsapp://send?phone=${wa.phone}&text=${wa.text}`
    : `https://wa.me/${wa.phone}?text=${wa.text}`;
}

/** Opens a WhatsApp receipt link; returns false if it was invalid or a popup blocker stopped it. */
export function openWhatsApp(link: string): boolean {
  const wa = parseWaMe(link);
  if (!wa) return false;
  if (isPhone()) {
    window.location.assign(`whatsapp://send?phone=${wa.phone}&text=${wa.text}`);
    return true;
  }
  const win = window.open(`https://wa.me/${wa.phone}?text=${wa.text}`, '_blank');
  if (win) win.opener = null;
  return Boolean(win);
}
