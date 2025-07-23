import { cookies } from 'next/headers';
import { auth } from '@/app/(auth)/auth';
import { redirect } from 'next/navigation';
import { ADKChat } from '@/components/adk-chat';
import { generateUUID } from '@/lib/utils';

export default async function ADKChatPage() {
  const session = await auth();

  if (!session) {
    redirect('/api/auth/guest');
  }

  const id = generateUUID();

  return (
    <div className="flex h-screen flex-col">
      <ADKChat
        key={id}
        id={id}
        session={session}
      />
    </div>
  );
} 