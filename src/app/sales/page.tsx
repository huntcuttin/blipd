import { Suspense } from "react";
import SalesPage from "./SalesPage";

export default function Page() {
  return (
    <Suspense>
      <SalesPage />
    </Suspense>
  );
}
