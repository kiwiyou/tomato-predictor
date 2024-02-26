import { getCurrentArenas } from "~/solved";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export async function GET(
  request: Request,
  { params }: { params: { contest: string } }
) {
  const arenas = await getCurrentArenas();
  const arena = arenas.find(
    (arena) => arena.arenaBojContestId === +params.contest
  );
  if (arena === undefined) {
    return new Response("Not Found", {
      status: 404,
    });
  }
  return Response.json(arena);
}
