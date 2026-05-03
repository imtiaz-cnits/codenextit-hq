import { PageHeaderSkeleton, TableSkeleton } from "../../../components/loading-skeletons";
import { Skeleton } from "../../../components/ui/skeleton";

export default function FinanceLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="flex gap-2 p-1 bg-muted/20 rounded-lg w-full max-w-[400px]">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 flex-1" />
      </div>
      <TableSkeleton rows={8} cols={7} />
    </div>
  );
}
