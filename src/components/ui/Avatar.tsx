import { getInitials, cn } from '../../utils/helpers';

const COLORS = [
  'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500',
  'bg-lime-500', 'bg-green-500', 'bg-teal-500', 'bg-cyan-500',
  'bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-purple-500',
];

function colorFromName(name: string) {
  const code = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return COLORS[code % COLORS.length];
}

interface AvatarProps {
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = { xs: 'h-6 w-6 text-xs', sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-12 w-12 text-base' };

export function Avatar({ name, size = 'md', className }: AvatarProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center justify-center rounded-full text-white font-semibold shrink-0',
        colorFromName(name),
        sizes[size],
        className
      )}
    >
      {getInitials(name)}
    </div>
  );
}
