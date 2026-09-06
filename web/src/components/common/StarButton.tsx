import React from 'react';
import { Star } from 'lucide-react';
import { useStorage } from '../../context/StorageContext';
import { ResourceType } from '../../types/storage';

interface StarButtonProps {
  resourceType: ResourceType;
  id: string;
  starred?: boolean;
  /** Rows keep the control visible; cards reveal it on hover to stay clean. */
  alwaysVisible?: boolean;
  className?: string;
}

/**
 * Toggles a per-user star. Lives in one place because four different card and
 * row components need identical behaviour, including the click guard: every
 * one of them sits inside a parent that opens or selects the item on click.
 */
export const StarButton: React.FC<StarButtonProps> = ({
  resourceType,
  id,
  starred,
  alwaysVisible = false,
  className = '',
}) => {
  const { toggleStar } = useStorage();
  const on = Boolean(starred);

  return (
    <button
      type="button"
      id={`star-${resourceType}-${id}`}
      aria-pressed={on}
      aria-label={on ? 'Remove from Starred' : 'Add to Starred'}
      title={on ? 'Remove from Starred' : 'Add to Starred'}
      onClick={(e) => {
        // the row or card behind this opens the item on click
        e.stopPropagation();
        void toggleStar(resourceType, id, !on);
      }}
      className={`shrink-0 p-1 rounded-lg transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-amber-500/60 ${
        on ? 'text-amber-400 hover:text-amber-300' : 'text-gray-500 hover:text-amber-400'
      } ${
        // a star that is on must never be hidden, or the state is invisible
        on || alwaysVisible ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'
      } ${className}`}
    >
      <Star className={`w-3.5 h-3.5 ${on ? 'fill-amber-400' : ''}`} />
    </button>
  );
};
