import Link from "next/link";
import Image from "next/image";

export default function LandingPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center">
      <Image
        src="/MyMastersPoolstacked.png"
        alt="My Masters Pool"
        width={320}
        height={232}
        className="mb-6"
        priority
      />
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
