import { redirect } from "next/navigation";

export default function MessagesPageRedirect() {
  redirect("/dashboard/messages");
}
