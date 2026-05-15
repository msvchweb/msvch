export function PageHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-gray-50 to-white py-10 text-center md:py-20">
      {/* Decorative circles — 평주일엔 기존 톤, 절기엔 절기색 */}
      <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-liturgy-brand-soft/50" />
      <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-liturgy-soft/30" />

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
