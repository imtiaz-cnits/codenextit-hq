import { CardGridSkeleton, PageHeaderSkeleton } from "../../../components/loading-skeletons";

export default function InfrastructureLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <CardGridSkeleton count={9} />
    </div>
  );
}
