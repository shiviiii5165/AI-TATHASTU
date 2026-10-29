"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function VerifyRedirect({ destination }: { destination: string }) {
  const router = useRouter();
  const [progress, setProgress] = useState(25);

  useEffect(() => {
    const timer1 = setTimeout(() => setProgress(75), 200);
    const timer2 = setTimeout(() => {
      setProgress(100);
      router.replace(destination);
    }, 600);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [destination, router]);

  return (
    <div className="w-full mt-6 space-y-4">
      {/* Animated progress bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full bg-gradient-to-r from-[#FF2A85] via-[#FF5A36] to-[#10B981] transition-all duration-500 ease-out rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center justify-center gap-2 text-xs font-medium text-slate-500">
        <Loader2 className="size-3.5 animate-spin text-[#FF2A85]" />
        <span>Redirecting you now...</span>
      </div>
    </div>
  );
}

