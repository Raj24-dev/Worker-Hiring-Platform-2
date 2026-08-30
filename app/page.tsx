import { redirect } from "next/navigation";
import { myLanding } from "@/lib/session";

export default async function Home() {
  redirect(await myLanding());
}
