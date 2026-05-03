import { Skeleton } from "../../../components/ui/skeleton";

export default function AttendanceLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex gap-2 p-1 bg-muted/20 rounded-lg w-full max-w-[650px]">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 flex-1" />
        </div>

        <div className="border rounded-2xl p-6 space-y-6 shadow-md bg-card">
          <div className="flex justify-between items-center">
            <div className="space-y-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-60" />
            </div>
            <Skeleton className="h-10 w-24 rounded-lg" />
          </div>

          <div className="border rounded-xl overflow-hidden">
            <div className="bg-muted/30 p-4 border-b">
              <div className="grid grid-cols-6 gap-4">
                {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-4 w-full" />)}
              </div>
            </div>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="p-4 border-b last:border-b-0 flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/4" />
                  <Skeleton className="h-3 w-1/6" />
                </div>
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-8 w-24 rounded-lg ml-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
