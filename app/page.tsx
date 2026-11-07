import { CreateRoom } from "./create-room";
import { JoinToggle } from "./join-toggle";
import { YourRooms } from "./your-rooms";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-16 sm:py-24">
      <header className="mb-12 text-center sm:mb-16">
        <h1 className="text-5xl leading-[1.05] font-bold tracking-tight text-balance sm:text-7xl lg:text-8xl">
          Just Pick Something
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-balance text-zinc-600 sm:mt-6 sm:text-xl dark:text-zinc-400">
          Make a room, add options, vote, and stop arguing about it.
        </p>
      </header>
      <div className="mx-auto w-full max-w-md space-y-10">
        <CreateRoom />
        <JoinToggle />
        <YourRooms />
      </div>
    </main>
  );
}
