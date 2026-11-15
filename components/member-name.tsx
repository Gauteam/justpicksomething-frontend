// A member's name in their color, with a matching dot.
export function MemberName({ name, color }: { name: string; color?: string }) {
  return (
    <span className="inline-flex items-center gap-1 font-medium" style={color ? { color } : undefined}>
      <span
        aria-hidden
        className="inline-block h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: color ?? "currentColor" }}
      />
      {name}
    </span>
  );
}
