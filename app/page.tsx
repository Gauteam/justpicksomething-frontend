import { HealthStatus } from "./health-status";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-4 px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Just Pick Something</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Make a room, drop in options, vote, and stop arguing about it.
      </p>
      <HealthStatus />
    </main>
  );
}
