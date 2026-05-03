import { PageHeaderSkeleton, TableSkeleton } from "../../../components/loading-skeletons";

export default function LeaveLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <TableSkeleton rows={6} cols={6} />
    </div>
  );
}
