import { redirect } from "next/navigation";

export default function FavoritesAliasPage() {
  redirect("/my-properties?tab=saved");
}
