import { createFileRoute } from "@tanstack/react-router";
import { WelcomePage } from "@/components/welcome/WelcomePage";

export const Route = createFileRoute("/_app/welcome")({
  head: () => ({
    meta: [
      { title: "Pio - Near — Connect the dots" },
      { name: "description", content: "Pio - Near — Connect the dots. Set your intention and start your journey." },
      { property: "og:title", content: "Pio - Near — Connect the dots" },
      { property: "og:description", content: "Set your intention and start your journey." },
    ],
  }),
  component: WelcomePage,
});
