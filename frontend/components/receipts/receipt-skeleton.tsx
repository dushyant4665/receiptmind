"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function ReceiptRowSkeleton() {
  return (
    <div className="flex items-center gap-4 py-4 px-4 border-b border-border-subtle">
      {/* Thumbnail skeleton */}
      <Skeleton className="h-12 w-12 rounded-lg shrink-0" />
      
      {/* Content */}
      <div className="flex-1 min-w-0 grid grid-cols-5 gap-4">
        <div className="col-span-2 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-20" />
        </div>
        <div className="flex items-center justify-end gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function ReceiptCardSkeleton() {
  return (
    <div className="rounded-[12px] border border-border-default bg-bg-surface p-4 space-y-4">
      <div className="flex items-start gap-3">
        <Skeleton className="h-14 w-14 rounded-lg shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
    </div>
  );
}

export function ReceiptTableSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-1">
      {/* Header skeleton */}
      <div className="flex items-center gap-4 py-3 px-4 border-b border-border-default bg-bg-page">
        <Skeleton className="h-4 w-12 shrink-0" />
        <div className="flex-1 grid grid-cols-5 gap-4">
          <Skeleton className="h-4 w-20 col-span-2" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16 justify-self-end" />
        </div>
      </div>
      
      {/* Row skeletons */}
      {Array.from({ length: count }).map((_, i) => (
        <ReceiptRowSkeleton key={i} />
      ))}
    </div>
  );
}

export function DashboardStatsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-[12px] border border-border-default bg-bg-surface p-5 space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

export function ProcessingBadgeSkeleton() {
  return (
    <div className="flex items-center gap-2">
      <div className="h-4 w-4 rounded-full border-2 border-amber border-t-transparent animate-spin" />
      <span className="text-sm text-amber">Processing...</span>
    </div>
  );
}
