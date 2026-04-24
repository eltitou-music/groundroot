import { createFileRoute } from "@tanstack/react-router";
import { WelcomePage } from "@/components/welcome/WelcomePage";

export const Route = createFileRoute("/_app/welcome")({
  head: () => ({
    meta: [
      { title: "GroundRoot — Where every set takes root" },
      { name: "description", content: "Set an intention. Play, gather, assemble, master — GroundRoot is one continuous river from sound to set." },
      { property: "og:title", content: "GroundRoot — Where every set takes root" },
      { property: "og:description", content: "Set an intention. Play, gather, assemble, master." },
    ],
  }),
  component: WelcomePage,
});
