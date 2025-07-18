/* eslint-disable @typescript-eslint/no-explicit-any */
// http://localhost:4000/api/chat4

import { ChatOpenAI } from "@langchain/openai";
import { NextRequest, NextResponse } from "next/server";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { HttpResponseOutputParser } from "langchain/output_parsers";

export async function POST(req: NextRequest) {

    const body = await req.json();
    const messages: any[] = body.messages ?? [];
    const lastUserMessage = messages[messages.length - 1].content ?? "";


    const prompt = ChatPromptTemplate.fromMessages([
        ['system', 'คุณเป็นผู้จัดการฝ่าย HR บริษัท คอยตอบคำถามให้พนักงานในเรื่องทั่วไป และ สวัสดิการต่างๆ'],
        ['user', '{question}'],
    ]);

    const model = new ChatOpenAI({
        model: "gpt-4.1-nano",
        temperature: 0,
        maxTokens: 200,
    });

    const chain = prompt.pipe(model).pipe(new HttpResponseOutputParser());

    const streamResponse = await chain.stream({
        question: lastUserMessage
    });

    return new NextResponse(streamResponse, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    }); 
}