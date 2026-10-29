import { CreateRoom } from "./create-room";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-12 sm:py-20">
      <h1 className="text-3xl font-semibold tracking-tight">Just Pick Something</h1>
      <p className="mt-2 mb-8 text-zinc-600 dark:text-zinc-400">
        Make a room, drop in options, vote, and stop arguing about it.
      </p>
      <CreateRoom />
    </main>
  );
}
