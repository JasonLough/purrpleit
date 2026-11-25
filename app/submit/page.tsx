import { Suspense } from "react";
import { SubmitForm } from "@/components/SubmitForm";

export default function SubmitPage() {
  return (
    <div className="page">
      <main className="content">
        <h1 className="page-heading">submit to purrpleit</h1>
        <Suspense fallback={null}>
          <SubmitForm />
        </Suspense>
      </main>
    </div>
  );
}
