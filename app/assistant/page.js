import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import AssistantClient from "./AssistantClient";

export default async function AssistantPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return <AssistantClient />;
}
