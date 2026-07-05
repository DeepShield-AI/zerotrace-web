export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'h-4 w-4', md: 'h-8 w-8', lg: 'h-12 w-12' };
  return (
    <div className="flex justify-center py-20">
      <div className={`animate-spin ${sizes[size]} border-2 border-accent-primary border-t-transparent rounded-full`} />
    </div>
  );
}
