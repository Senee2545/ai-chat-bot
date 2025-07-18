import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// http://localhost:4000/api/user/d6165b8e-4788-4b36-81b9-0263e117a536
export async function GET(req: NextRequest, {params}: {params: Promise<{id: string}>}) {
    try{
        const supabase = await createClient();
        
        const userId = (await params).id;

        const { data } = await supabase.from('staff').select().eq('user_id', userId).single();

        if (!data) {
            return NextResponse.json({ error: 'ไม่พบข้อมูลผู้ใช้' }, { status: 404 });
        }

        return NextResponse.json(data);

    } catch (error) {
        return NextResponse.json(error, { status: 500 });
    }
}