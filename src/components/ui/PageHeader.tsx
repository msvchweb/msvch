export function PageHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="border-b border-gray-200 bg-gray-50 py-16 text-center">
      <h1 className="text-3xl font-bold text-gray-900 md:text-4xl">{title}</h1>
      {description && (
        <p className="mx-auto mt-4 max-w-2xl text-gray-600">{description}</p>
      )}
    </div>
  );
}
