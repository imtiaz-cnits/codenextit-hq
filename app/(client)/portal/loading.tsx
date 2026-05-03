import { KpiSkeleton, PageHeaderSkeleton, TableSkeleton } from "../../../components/loading-skeletons";

export default function ClientPortalLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <KpiSkeleton />
      <div className="space-y-4">
        <div className="h-6 w-32 bg-muted rounded animate-pulse" />
        <TableSkeleton rows={5} cols={5} />
      </div>
    </div>
  );
}
