import { redirect } from "next/navigation";

/** AI writing tools removed from the product; keep route for old bookmarks. */
export default function AiStudioPage() {
  redirect("/dashboard/messages/send");
}
