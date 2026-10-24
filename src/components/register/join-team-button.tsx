"use client";

import { Loader2Icon, UsersIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { joinWithSquadLink } from "@/app/college/register-actions";
import { Button } from "@/components/ui/button";

export function JoinTeamButton({ code }: { code: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      className="h-12 w-full rounded-full"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await joinWithSquadLink(code);
          if (!res.ok) return void toast.error(res.error);
          router.push("/college?joined=1");
        })
      }
    >
      {pending ? <Loader2Icon className="animate-spin" /> : <UsersIcon />} Join the team
    </Button>
  );
}
