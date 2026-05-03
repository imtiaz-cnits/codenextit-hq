import { PageHeaderSkeleton, TableSkeleton } from "../../../components/loading-skeletons";

export default function PayrollLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <TableSkeleton rows={8} cols={7} />
    </div>
  );
}
