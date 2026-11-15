// Small dots in the colors of the people who commented somewhere; up to four,
// then "+n".
export function CommenterDots({ ids, colors }: { ids: string[]; colors: Map<string, string> }) {
  if (ids.length === 0) return null;
  const shown = ids.slice(0, 4);
  return (
    <span aria-hidden className="inline-flex items-center gap-0.5">
      {shown.map((id) => (
        <span
          key={id}
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: colors.get(id) ?? "#a1a1aa" }}
        />
      ))}
      {ids.length > shown.length && <span className="text-[0.6rem] leading-none">+{ids.length - shown.length}</span>}
    </span>
  );
}
