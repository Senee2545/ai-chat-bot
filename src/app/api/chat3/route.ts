/* eslint-disable @typescript-eslint/no-explicit-any */
// http://localhost:4000/api/chat3

import { ChatOpenAI } from "@langchain/openai";
import { NextRequest, NextResponse } from "next/server";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

export async function POST(req: NextRequest) {

    const body = await req.json();
    const messages: any[] = body.messages ?? [];


    const prompt = ChatPromptTemplate.fromMessages([
        ['system', 'คุณเป็นผู้จัดการฝ่าย HR บริษัท คอยตอบคำถามให้พนักงานในเรื่องทั่วไป และ สวัสดิการต่างๆ'],
        ['user', '{question}'],
    ]);

    const model = new ChatOpenAI({
        model: "gpt-4.1-nano",
        temperature: 0,
        maxTokens: 200,
    });

    const chain = prompt.pipe(model).pipe(new StringOutputParser());

    const response = await chain.invoke({
        question: messages[messages.length - 1].content ?? "",
    });

    return NextResponse.json({ AI_Message: response });
}