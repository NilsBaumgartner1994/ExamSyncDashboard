// src/components/ChatTile.tsx
import React, { useState } from 'react';
import { Button, ScrollArea, Stack, Text, TextInput } from '@mantine/core';
import { TileWrapper } from './TileWrapper';

export interface ChatMessage {
    user: string;
    text: string;
}

interface ChatTileProps {
    title: string;
    messages: ChatMessage[];
    onSend: (msg: ChatMessage) => void;
    nickname: string;
    defaultSpan?: number;
    onSpanChange?: (span: number) => void;
}

export function ChatTile({
                             title,
                             messages,
                             onSend,
                             nickname,
                             defaultSpan = 3,
                             onSpanChange,
                         }: ChatTileProps) {
    const [input, setInput] = useState('');

    const handleSend = () => {
        if (input.trim()) {
            onSend({ user: nickname, text: input });
            setInput('');
        }
    };

    return (
        <TileWrapper title={title} defaultSpan={defaultSpan} onSpanChange={onSpanChange}>
            <Stack>
                <ScrollArea h={150}>
                    {messages.map((msg, i) => (
                        <Text key={i}>
                            <strong>{msg.user}:</strong> {msg.text}
                        </Text>
                    ))}
                </ScrollArea>
                <TextInput
                    placeholder="Nachricht eingeben"
                    value={input}
                    onChange={(e) => setInput(e.currentTarget.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                />
                <Button onClick={handleSend}>Senden</Button>
            </Stack>
        </TileWrapper>
    );
}