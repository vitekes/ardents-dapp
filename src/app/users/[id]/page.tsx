import Image from 'next/image';
import prisma from '@/lib/prisma';
import Placeholder from '@/components/Placeholder';

interface Params { id: string }

async function getUser(id: string) {
  return prisma.siteUser.findUnique({
    where: { id },
    select: {
      display_name: true,
      avatar_url: true,
      bio: true,
      created_at: true,
      last_seen: true,
    },
  });
}

async function getWallets(id: string) {
  return prisma.wallet.findMany({
    where: { user_id: id },
    select: { caip10_id: true, label: true, is_primary: true },
    orderBy: { created_at: 'asc' },
  });
}

export default async function Page({ params }: { params: Params }) {
  const user = await getUser(params.id);
  if (!user) return <div className="p-4">User not found</div>;
  const wallets = await getWallets(params.id);

  const online = user.last_seen && Date.now() - new Date(user.last_seen).getTime() < 5 * 60 * 1000;

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center space-x-4">
        <Image
          src={user.avatar_url || '/placeholder.png'}
          alt="avatar"
          width={96}
          height={96}
          className="rounded-full object-cover"
        />
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            {user.display_name}
            {online && <span className="text-sm px-2 py-0.5 bg-green-600 text-white rounded">online</span>}
          </h1>
          <p className="text-sm text-gray-500">Joined {new Date(user.created_at).toLocaleDateString()}</p>
        </div>
      </div>
      {user.bio && <p>{user.bio}</p>}

      <section>
        <h2 className="text-xl font-medium mb-2">Wallets</h2>
        <ul className="space-y-1">
          {wallets.map((w: Awaited<ReturnType<typeof getWallets>>[number]) => (
            <li key={w.caip10_id} className="flex items-center gap-2">
              <span>{w.caip10_id}</span>
              {w.label && <span className="text-gray-500 text-sm">({w.label})</span>}
              {w.is_primary && <span className="text-blue-500 text-xs">primary</span>}
              {!w.is_primary && (
                <form action={`/api/users/${params.id}/wallets/${encodeURIComponent(w.caip10_id)}/primary`} method="POST">
                  <button className="text-xs text-blue-600 underline" type="submit">Set primary</button>
                </form>
              )}
            </li>
          ))}
        </ul>
        <form action={`/api/users/${params.id}/wallets`} method="POST" className="mt-4 space-x-2">
          <input name="caip10" placeholder="caip10" className="border px-2 py-1" />
          <input name="label" placeholder="label" className="border px-2 py-1" />
          <button type="submit" className="px-2 py-1 border">Add wallet</button>
        </form>
      </section>

      <section>
        <h2 className="text-xl font-medium mb-2">Tiers</h2>
        <Placeholder />
      </section>

      <section>
        <h2 className="text-xl font-medium mb-2">Social</h2>
        <div className="grid grid-cols-2 gap-4 text-sm text-gray-500">
          <div>Posts: --</div>
          <div>Likes: --</div>
          <div>Subscribers: --</div>
          <div>Achievements: --</div>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-medium mb-2">Admin flags</h2>
        <form action={`/api/users/${params.id}/flags`} method="POST" className="space-x-2">
          <input name="flag" placeholder="achievement" className="border px-2 py-1" />
          <button type="submit" className="px-2 py-1 border">Assign</button>
        </form>
      </section>
    </div>
  );
}
