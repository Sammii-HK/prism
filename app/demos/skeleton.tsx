"use client";
import { Skeleton } from "../lib/components/skeleton";

export default function SkeletonDemo() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: "#050505" }}
    >
      <div className="flex flex-col items-center gap-8">
        <p className="text-xs tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.25)" }}>
          skeleton
        </p>

        <div
          className="flex flex-col gap-4 p-6 rounded-xl"
          style={{
            border: "1px solid rgba(255,255,255,0.06)",
            backgroundColor: "rgba(255,255,255,0.02)",
            width: 320,
          }}
        >
          <div className="flex items-center gap-3">
            <Skeleton width={40} height={40} rounded="rounded-full" />
            <div className="flex flex-col gap-2 flex-1">
              <Skeleton width="70%" height={12} />
              <Skeleton width="45%" height={10} />
            </div>
          </div>
          <Skeleton width="100%" height={14} />
          <Skeleton width="85%" height={14} />
          <Skeleton width="100%" height={80} rounded="rounded-lg" />
        </div>

        <p
          className="text-xs italic"
          style={{ color: "rgba(255,255,255,0.2)" }}
        >
          Move your cursor to tint the shimmer.
        </p>
      </div>
    </div>
  );
}
