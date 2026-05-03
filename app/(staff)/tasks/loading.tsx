import { PageHeaderSkeleton, TableSkeleton } from "../../../components/loading-skeletons";

export default function TasksLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <TableSkeleton rows={8} cols={6} />
    </div>
  );
}
