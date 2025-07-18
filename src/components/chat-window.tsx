/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import {
    ChatContainerContent,
    ChatContainerRoot,
} from "@/components/ui/chat-container"
import {
    Message,
    MessageAction,
    MessageActions,
    MessageContent,
} from "@/components/ui/message"
import {
    PromptInput,
    PromptInputAction,
    PromptInputActions,
    PromptInputTextarea,
} from "@/components/ui/prompt-input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
    ArrowUp,
    Copy,
    Globe,
    Mic,
    MoreHorizontal,
    Pencil,
    Plus,
    ThumbsDown,
    ThumbsUp,
    Trash,
} from "lucide-react"
import { LogoutButton } from "./logout-button"
import { useChat } from "@ai-sdk/react"
import { ResponseStream } from "./ui/response-stream"


function ChatWindow(props: { email: string, id: string }) {
    const {
        messages,
        input,
        handleInputChange,
        handleSubmit,
        status,
        error,
        stop
    } = useChat({ api: 'api/chat8', streamProtocol: 'text' });

    const isLoading = status === 'submitted' || status === 'streaming';

    return (
        <div className="flex h-screen flex-col overflow-hidden">

            <div className="bg-gray-800 text-white px-6 py-4 shadow-md">
                <div className="flex justify-between items-center">
                    {/* AI ChatBot สำหรับงาน HR */}
                    <h1 className="text-2xl md:text-3xl font-bold text-green-400">
                        AI ChatBot DOA
                    </h1>

                    {/* ข้อมูลผู้ใช้ และ Logout  */}
                    <div className="flex items-center gap-4">
                        <p className="text-sm md:text-base text-gray-200">
                            สวัสดี <span className="font-semibold">{props.email}</span> | ID: <span className="font-semibold">{props.id}</span>
                        </p>
                        <LogoutButton />
                    </div>
                </div>
            </div>



            <ChatContainerRoot className="relative flex-1 space-y-0 overflow-y-auto px-4 py-12">
                <ChatContainerContent className="space-y-12 px-4 py-12">
                    {
                        messages.length === 0 && (
                            <div className="text-center text-gray-400 my-8">
                                เริ่มต้นการสนทนาด้วยการพิมพ์ข้อความด้านล่าง
                            </div>
                        )
                    }
                    {messages.map((message, index) => {
                        const isAssistant = message.role === "assistant"
                        const isLastMessage = index === messages.length - 1

                        return (
                            <Message
                                key={message.id}
                                className={cn(
                                    "mx-auto flex w-full max-w-3xl flex-col gap-2 px-0 md:px-6",
                                    isAssistant ? "items-start" : "items-end"
                                )}
                            >
                                {isAssistant ? (
                                    <div className="group flex w-full flex-col gap-0">
                                        <div
                                            className="text-foreground prose w-full flex-1 rounded-lg bg-transparent p-0"
                                        >
                                            <ResponseStream
                                                textStream={JSON.parse(message.content)}
                                                mode="typewriter"
                                                speed={20}
                                                as="p"
                                                className="whitespace-pre-line"
                                            />

                                        </div>
                                        <MessageActions
                                            className={cn(
                                                "-ml-2.5 flex gap-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100",
                                                isLastMessage && "opacity-100"
                                            )}
                                        >
                                            <MessageAction tooltip="Edit" delayDuration={100}>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="rounded-full"
                                                >
                                                    <Copy />
                                                </Button>
                                            </MessageAction>
                                            <MessageAction tooltip="Upvote" delayDuration={100}>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="rounded-full"
                                                >
                                                    <ThumbsUp />
                                                </Button>
                                            </MessageAction>
                                            <MessageAction tooltip="Downvote" delayDuration={100}>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="rounded-full"
                                                >
                                                    <ThumbsDown />
                                                </Button>
                                            </MessageAction>
                                        </MessageActions>
                                    </div>
                                ) : (
                                    <div className="group flex flex-col items-end gap-1">
                                        <MessageContent className="bg-muted text-primary max-w-[95%] rounded-3xl px-5 py-2.5 sm:max-w-[85%]">
                                            {message.content}
                                        </MessageContent>
                                        <MessageActions
                                            className={cn(
                                                "flex gap-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                                            )}
                                        >
                                            <MessageAction tooltip="Edit" delayDuration={100}>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="rounded-full"
                                                >
                                                    <Pencil />
                                                </Button>
                                            </MessageAction>
                                            <MessageAction tooltip="Delete" delayDuration={100}>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="rounded-full"
                                                >
                                                    <Trash />
                                                </Button>
                                            </MessageAction>
                                            <MessageAction tooltip="Copy" delayDuration={100}>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="rounded-full"
                                                >
                                                    <Copy />
                                                </Button>
                                            </MessageAction>
                                        </MessageActions>
                                    </div>
                                )}

                                {error && <p className="text-red-500"> {error.message}</p>}

                            </Message>
                        )
                    })}

                    {status === 'submitted' && (
                        <Message
                            className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-0 items-start"
                        >
                            <MessageContent className="text-muted-foreground w-full flex-1 rounded-lg bg-transparent p-0 select-none">
                                {"Typing..."}
                            </MessageContent>
                        </Message>
                    )}

                </ChatContainerContent>
            </ChatContainerRoot>
            <div className="inset-x-0 bottom-0 mx-auto w-full max-w-3xl shrink-0 px-3 pb-3 md:px-5 md:pb-5">
                <PromptInput
                    isLoading={isLoading}
                    value={input}
                    onValueChange={(value) => handleInputChange({ target: { value } } as any)}
                    onSubmit={handleSubmit}
                    className="border-input bg-popover relative z-10 w-full rounded-3xl border p-0 pt-1 shadow-xs"
                >
                    <div className="flex flex-col">
                        <PromptInputTextarea
                            placeholder="Ask anything"
                            className="min-h-[44px] pt-3 pl-4 text-base leading-[1.3] sm:text-base md:text-base"
                        />

                        <PromptInputActions className="mt-5 flex w-full items-center justify-between gap-2 px-3 pb-3">
                            <div className="flex items-center gap-2">
                                <PromptInputAction tooltip="Add a new action">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="size-9 rounded-full"
                                    >
                                        <Plus size={18} />
                                    </Button>
                                </PromptInputAction>

                                <PromptInputAction tooltip="Search">
                                    <Button variant="outline" className="rounded-full">
                                        <Globe size={18} />
                                        Search
                                    </Button>
                                </PromptInputAction>

                                <PromptInputAction tooltip="More actions">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="size-9 rounded-full"
                                    >
                                        <MoreHorizontal size={18} />
                                    </Button>
                                </PromptInputAction>
                            </div>
                            <div className="flex items-center gap-2">
                                <PromptInputAction tooltip="Voice input">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="size-9 rounded-full"
                                    >
                                        <Mic size={18} />
                                    </Button>
                                </PromptInputAction>

                                <Button
                                    size="icon"
                                    disabled={!input.trim() || isLoading}
                                    onClick={handleSubmit}
                                    className="size-9 rounded-full"
                                >
                                    {!isLoading ? (
                                        <ArrowUp size={18} />
                                    ) : (
                                        <span className="size-3 rounded-xs bg-white" />
                                    )}
                                </Button>

                                {isLoading && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        type="button"
                                        onClick={stop}
                                    >
                                        Stop
                                    </Button>
                                )}

                            </div>
                        </PromptInputActions>
                    </div>
                </PromptInput>
            </div>
        </div>
    )
}

export { ChatWindow }
