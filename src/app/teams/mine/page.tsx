import { redirect } from "next/navigation";

/** Legacy route — teams and my teams are one page at /teams. */
export default function MyTeamsRedirect() {
  redirect("/teams");
}
