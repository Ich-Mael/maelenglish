import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { connectDB } from "@/lib/db";
import { getDiagnostic } from "@/lib/diagnostic/service";
import { Container } from "@/components/site/ui";
import { DiagnosticReportView } from "../../report-view";

export const metadata: Metadata = { title: "Votre diagnostic", robots: { index: false, follow: false } };

/** The report again, from the link in the email (the token is the access key; the page is never indexed). */
async function Report({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  await connection();
  await connectDB();
  const r = await getDiagnostic(decodeURIComponent(token));
  if (!r) notFound();
  return <DiagnosticReportView result={r} />;
}

export default function Page({ params }: { params: Promise<{ token: string }> }) {
  return (
    <section className="bg-[#F0F4FB] py-10 sm:py-16">
      <Container className="max-w-4xl">
        <Suspense fallback={<div className="h-[60vh] animate-pulse rounded-[2rem] bg-white" aria-busy />}>
          <Report params={params} />
        </Suspense>
      </Container>
    </section>
  );
}
