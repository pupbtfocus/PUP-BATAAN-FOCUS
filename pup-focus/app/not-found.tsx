import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
      <h2 className="text-2xl font-bold text-slate-800">Page Not Found</h2>
      <p className="mt-2 text-sm text-slate-600">Could not find requested resource</p>
      <Link
        href="/"
        className="mt-4 rounded-lg bg-[#800000] px-4 py-2 text-sm font-semibold text-white hover:bg-[#660000]"
      >
        Return Home
      </Link>
    </div>
  );
}
