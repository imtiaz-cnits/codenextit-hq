import { CardGridSkeleton, PageHeaderSkeleton } from "../../../components/loading-skeletons";

export default function AccountsLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <CardGridSkeleton count={4} />
    </div>
  );
}
