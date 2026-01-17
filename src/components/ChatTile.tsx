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
    onNicknameChange: (nickname: string) => void;
    defaultSpan?: number;
    onSpanChange?: (span: number) => void;
    onClose?: () => void;
}

export function ChatTile({
                             title,
                             messages,
                             onSend,
                             nickname,
                             onNicknameChange,
                             defaultSpan = 3,
                             onSpanChange,
                             onClose,
                         }: ChatTileProps) {
    const [input, setInput] = useState('');

    const handleSend = () => {
        if (input.trim()) {
            const displayName = nickname.trim() || 'Anonym';
            onSend({ user: displayName, text: input });
            setInput('');
        }
    };

    return (
        <TileWrapper
            title={title}
            defaultSpan={defaultSpan}
            onSpanChange={onSpanChange}
            onClose={onClose}
        >
            <Stack>
                <ScrollArea h={150}>
                    {messages.map((msg, i) => (
                        <Text key={i}>
                            <strong>{msg.user}:</strong> {msg.text}
                        </Text>
                    ))}
                </ScrollArea>
                <TextInput
                    label="Dein Name"
                    placeholder="Name eingeben"
                    value={nickname}
                    onChange={(e) => onNicknameChange(e.currentTarget.value)}
                />
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
