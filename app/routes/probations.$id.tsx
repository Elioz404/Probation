import { useParams } from "react-router";

import { ProbationPage } from "@/components/probation/ProbationPage";
import { APP_TITLE } from "@/lib/app-config";

export function meta() {
  return [{ title: APP_TITLE }];
}

export default function ProbationRoute() {
  const { id } = useParams();
  return id ? <ProbationPage key={id} id={id} /> : null;
}
