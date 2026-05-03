import { CardGridSkeleton, PageHeaderSkeleton } from "../../../components/loading-skeletons";

export default function ProjectsLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <CardGridSkeleton count={6} />
    </div>
  );
}
