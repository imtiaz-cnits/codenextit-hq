import { CardGridSkeleton, PageHeaderSkeleton } from "../../../components/loading-skeletons";

export default function TeamLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <CardGridSkeleton count={8} />
    </div>
  );
}
