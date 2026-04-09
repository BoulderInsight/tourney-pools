import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center">
      <div className="w-24 h-24 rounded-full bg-masters-green/10 flex items-center justify-center mb-8">
        <svg className="w-14 h-14 text-masters-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
        </svg>
      </div>

      <h1 className="font-serif text-3xl font-bold text-masters-green mb-3 leading-tight">
        Masters Pool
      </h1>
      <p className="text-gray-500 text-sm mb-10 max-w-xs leading-relaxed">
        Create a golf pool, draft golfers with friends, and track live scores through tournament week.
      </p>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link href="/signup" className="btn-green text-center">
          Create a Pool
        </Link>
        <Link href="/login" className="btn-outline text-center">
          Sign In
        </Link>
      </div>

      <p className="text-xs text-gray-400 mt-8">
        Have an invite link? Just open it to view the leaderboard.
      </p>
    </div>
  );
}
