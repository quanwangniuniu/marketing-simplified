'use client';

import React, { useEffect, useState } from 'react';
import { User } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface UserAvatarProps {
  user?: {
    name: string;
    avatar?: string;
    email?: string;
  } | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showTooltip?: boolean;
  fallbackText?: string;
  /**
   * When there is no profile image: `initials` (default) or a neutral person icon on gray
   * (e.g. compact task cards when the API omits `avatar`).
   */
  emptyAvatar?: 'initials' | 'user-icon';
}

const sizeClasses = {
  xs: 'w-5 h-5 text-xs',
  sm: 'w-6 h-6 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-10 h-10 text-base',
  xl: 'w-12 h-12 text-lg',
};

/**
 * UserAvatar Component
 * Displays a user's avatar image or initials fallback
 */
const UserAvatar: React.FC<UserAvatarProps> = ({
  user,
  size = 'md',
  className = '',
  showTooltip = false,
  fallbackText,
  emptyAvatar = 'initials',
}) => {
  const [imgError, setImgError] = useState(false);
  useEffect(() => {
    setImgError(false);
  }, [user?.avatar]);
  const getInitials = (name: string): string => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getAvatarColor = (name: string): string => {
    // Generate a consistent color based on the name
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      const code = name.codePointAt(i) ?? 0;
      hash = code + ((hash << 5) - hash);
    }
    const hue = hash % 360;
    return `hsl(${hue}, 65%, 50%)`;
  };

  const displayName = user?.name || fallbackText || 'Unknown';
  const initials = getInitials(displayName);
  const bgColor = getAvatarColor(displayName);
  const sizeClass = sizeClasses[size];
  const showUserIcon =
    emptyAvatar === 'user-icon' && (!user?.avatar || imgError);
  const showImg = user?.avatar && !imgError;

  const userIconClass = { xs: 'h-2.5 w-2.5', sm: 'h-3.5 w-3.5', md: 'h-4 w-4', lg: 'h-5 w-5', xl: 'h-6 w-6' }[size];

  const neutralPlaceholder = (
    <User className={cn('shrink-0 text-gray-500', userIconClass)} strokeWidth={2} aria-hidden />
  );

  const avatarContent = (
    <div
      className={cn(
        'relative flex items-center justify-center rounded-full overflow-hidden',
        showUserIcon
          ? 'bg-gray-200 text-gray-500'
          : 'bg-gray-200 border border-gray-300',
        sizeClass,
        className
      )}
      style={showUserIcon || showImg ? undefined : { backgroundColor: bgColor, color: 'white' }}
      title={showTooltip ? displayName : undefined}
    >
      {showImg ? (
        <img
          src={user!.avatar!}
          alt={displayName}
          className="h-full w-full object-cover"
          onError={() => {
            setImgError(true);
          }}
        />
      ) : showUserIcon ? (
        neutralPlaceholder
      ) : (
        <span className="font-medium select-none">{initials}</span>
      )}
    </div>
  );

  if (showTooltip && user) {
    return (
      <div className="relative group">
        {avatarContent}
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
          {displayName}
          {user.email && (
            <>
              <br />
              <span className="text-gray-400">{user.email}</span>
            </>
          )}
        </div>
      </div>
    );
  }

  return avatarContent;
};

export default UserAvatar;
