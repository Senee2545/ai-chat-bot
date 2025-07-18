/* eslint-disable @typescript-eslint/no-explicit-any */
// http://localhost:4000/api/chat2

import { ChatOpenAI } from "@langchain/openai";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {

    const body = await req.json();
    const messages: any[] = body.messages ?? [];

    const model = new ChatOpenAI({
        model: "gpt-4.1-nano",
        temperature: 0,
        maxTokens: 200,
    });

    const response = await model.invoke(messages); 

    return NextResponse.json({ AI_Message: response.content });
}