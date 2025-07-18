import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { ChatWindow } from '@/components/chat-window'

export default async function ChatPage() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    redirect('/auth/login')
  }

  return (
    <>
    {
      data?.user?.email && <ChatWindow email={data.user.email} id={data.user.id} />
    }
    </>
  )
}
