import { Suspense } from "react";
import { Loading, RoomView } from "./room-view";

export default function RoomPage({ params }: PageProps<"/r/[slug]">) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-12">
      <Suspense fallback={<Loading />}>
        {params.then(({ slug }) => (
          <RoomView slug={slug} />
        ))}
      </Suspense>
    </main>
  );
}
