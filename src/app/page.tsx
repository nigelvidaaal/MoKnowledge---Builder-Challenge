// The '/' route: redirects to /knowledge.

import { redirect } from "next/navigation";

export default function Home() {
  redirect("/knowledge");
}

// url from -> live progress -> review workspace
