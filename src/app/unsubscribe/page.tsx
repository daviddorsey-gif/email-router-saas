// src/app/unsubscribe/page.tsx
import Link from "next/link";

export default function UnsubIndexPage() {
  return (
    <main className="max-w-xl mx-auto p-8">
      <h1 className="text-2xl font-semibold mb-2">Unsubscribe</h1>
      <p className="text-gray-600 mb-4">
        If you reached this page from an email, your request may already be recorded.
      </p>
      <p>
        You can also visit{" "}
        <Link href="/unsubscribe/thanks" className="underline">
          the confirmation page
        </Link>
        .
      </p>
    </main>
  );
}
