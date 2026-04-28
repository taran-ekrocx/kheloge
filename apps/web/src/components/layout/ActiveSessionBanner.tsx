"use client";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export function ActiveSessionBanner() {
  const router = useRouter();
  const { data: session } = useQuery({
    queryKey: ["my-active-session"],
    queryFn: () => api.get("/attendance/sessions/my-active").then((r) => r.data),
    refetchInterval: 30_000,
    retry: false,
  });
  if (!session) return null;
  return (
    <div
      className="w-full bg-amber-500 text-white text-sm text-center py-2 px-4 cursor-pointer hover:bg-amber-600 transition-colors"
      onClick={() => router.push(`/attendance/${session.batchId}?sessionId=${session.id}`)}
    >
      Session active for <strong>{session.batch?.name}</strong> — click to return
    </div>
  );
}
