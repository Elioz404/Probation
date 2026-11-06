import { ProbationsHome } from "@/components/probation/ProbationsHome";
import { APP_TITLE } from "@/lib/app-config";

const SEO_DESCRIPTION =
  "Agents earn their autonomy: examined on your real issue history, promoted by your signature, demoted by your corrections.";

export function meta() {
  return [
    { title: APP_TITLE },
    { name: "description", content: SEO_DESCRIPTION },
    { property: "og:title", content: APP_TITLE },
    { property: "og:description", content: SEO_DESCRIPTION },
  ];
}

export default function HomeRoute() {
  return <ProbationsHome />;
}
