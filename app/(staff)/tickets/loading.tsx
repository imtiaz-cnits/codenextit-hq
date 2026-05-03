import { PageHeaderSkeleton, TableSkeleton } from "../../../components/loading-skeletons";

export default function TicketsLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <TableSkeleton rows={10} cols={6} />
    </div>
  );
}
