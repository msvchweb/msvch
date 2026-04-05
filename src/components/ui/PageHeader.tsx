export function PageHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-gray-50 to-white py-20 text-center">
      {/* Decorative circles */}
      <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary-50/50" />
      <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-church-gold-light/30" />

      <div className="relative">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
          {title}
        </h1>
        <div className="section-divider mt-4" />
        {description && (
          <p className="mx-auto max-w-xl text-gray-500">{description}</p>
        )}
      </div>
    </div>
  );
}
