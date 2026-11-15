// A value that's just a link shows as a compact badge: the domain with an
// arrow, opening the page in a new tab.

// True if the whole value is one http(s) URL.
export function isUrl(value: string): boolean {
  const v = value.trim();
  if (!/^https?:\/\/\S+$/i.test(v)) return false;
  try {
    new URL(v);
    return true;
  } catch {
    return false;
  }
}

// "https://www.vrbo.com/123" → "vrbo.com"
export function linkHost(value: string): string {
  try {
    return new URL(value.trim()).hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}

// A readable name made from a link when the page has no fetchable title:
// "https://www.vrbo.com/1234567?x=1" → "vrbo.com/1234567".
export function nameFromLink(value: string): string {
  try {
    const u = new URL(value.trim());
    const path = u.pathname.replace(/\/+$/, "");
    const name = `${u.hostname.replace(/^www\./, "")}${path}`;
    return name.length > 80 ? `${name.slice(0, 79)}…` : name;
  } catch {
    return value.trim().slice(0, 80);
  }
}

export function LinkBadge({ href }: { href: string }) {
  return (
    <a
      href={href.trim()}
      target="_blank"
      rel="noopener noreferrer nofollow"
      title={href}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      className="inline-flex max-w-full items-center gap-1 rounded-full border border-zinc-300 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-800 select-none [-webkit-touch-callout:none] hover:border-zinc-500 hover:bg-white dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-500"
    >
      <span className="truncate">{linkHost(href)}</span>
      <span aria-hidden>↗</span>
    </a>
  );
}
