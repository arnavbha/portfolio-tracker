interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
}

export function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
      <div className="text-4xl mb-3">{icon}</div>
      <div className="font-medium text-zinc-400">{title}</div>
      <div className="text-sm mt-1">{description}</div>
    </div>
  );
}
