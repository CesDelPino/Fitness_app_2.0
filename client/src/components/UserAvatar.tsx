import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserCircle } from "lucide-react";

interface UserAvatarProps {
  photoPath?: string | null;
  imageUrl?: string | null;
  name?: string;
  className?: string;
  fallbackClassName?: string;
}

function buildSupabaseStorageUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/storage/v1/object/public/avatars/${path}`;
}

export function UserAvatar({ 
  photoPath,
  imageUrl,
  name, 
  className,
  fallbackClassName 
}: UserAvatarProps) {
  const avatarUrl = photoPath 
    ? buildSupabaseStorageUrl(photoPath)
    : imageUrl || null;

  const initials = name
    ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : null;

  return (
    <Avatar className={className}>
      {avatarUrl ? (
        <AvatarImage src={avatarUrl} alt={name || "User avatar"} />
      ) : null}
      <AvatarFallback className={fallbackClassName}>
        {initials || <UserCircle className="w-5 h-5 text-muted-foreground" />}
      </AvatarFallback>
    </Avatar>
  );
}
