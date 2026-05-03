import { CardGridSkeleton, PageHeaderSkeleton } from "../../../components/loading-skeletons";

export function VaultLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <CardGridSkeleton count={6} />
    </div>
  );
}

export default VaultLoading;
