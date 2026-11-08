import { json } from '@/lib/http';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return json({ user: null }, 401);
  return json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      username: user.creator ? user.creator.username : null,
    },
  });
}
