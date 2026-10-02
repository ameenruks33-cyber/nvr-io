'use client';

import { useEffect } from 'react';

const SKIP_TYPES = new Set(['password', 'hidden', 'file', 'checkbox', 'radio']);

/** Stop browsers and keyboards from remembering typed customer details. */
function harden(node: ParentNode | Element) {
  const fields: Element[] = [];
  if (node instanceof Element && node.matches('input, textarea')) fields.push(node);
  fields.push(...Array.from(node.querySelectorAll?.('input, textarea') ?? []));
  for (const el of fields) {
    const field = el as HTMLInputElement | HTMLTextAreaElement;
    if (field instanceof HTMLInputElement && SKIP_TYPES.has(field.type)) continue;
    if (!field.hasAttribute('autocomplete')) field.setAttribute('autocomplete', 'off');
    field.setAttribute('autocorrect', 'off');
    field.spellcheck = false;
  }
}

/**
 * Device privacy: blank the screen when the app goes to the background (so the
 * recent-apps preview shows nothing) and turn off autofill/keyboard learning.
 */
export function PrivacyGuard() {
  useEffect(() => {
    const root = document.documentElement;
    const cover = () => root.classList.add('nvr-private');
    const uncover = () => root.classList.remove('nvr-private');
    const onVisibility = () =>
      document.visibilityState === 'hidden' ? cover() : uncover();

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', cover);
    window.addEventListener('pageshow', uncover);

    harden(document);
    const observer = new MutationObserver((records) => {
      for (const r of records) {
        r.addedNodes.forEach((n) => {
          if (n instanceof Element) harden(n);
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', cover);
      window.removeEventListener('pageshow', uncover);
      observer.disconnect();
    };
  }, []);

  return null;
}
