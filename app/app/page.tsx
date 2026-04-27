import { redirect } from "next/navigation";

// Diese App ist reines Admin-Backend für Hugo. Stammseite leitet auf /admin/.
export default function Home() {
  redirect("/admin/index.html");
}
