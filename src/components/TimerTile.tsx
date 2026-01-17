// src/components/TimerTile.tsx
import React, { useEffect, useState } from 'react';
import { Button, Stack, Text, TextInput } from '@mantine/core';
import { TileWrapper } from './TileWrapper';

interface TimerTileProps {
    title: string;
    endTime: Date | null;
    onSetMinutes: (minutes: number) => void;
    defaultSpan?: number;
    onSpanChange?: (span: number) => void;
}

export function TimerTile({
                              title,
                              endTime,
                              onSetMinutes,
                              defaultSpan = 2,
                              onSpanChange,
                          }: TimerTileProps) {
    const [input, setInput] = useState('');
    const [remaining, setRemaining] = useState('');

    useEffect(() => {
        const interval = setInterval(() => {
            if (!endTime) return setRemaining('nicht gesetzt');
            const diff = Math.max(0, endTime.getTime() - Date.now());
            const m = Math.floor(diff / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            setRemaining(`${m}m ${s}s`);
        }, 1000);
        return () => clearInterval(interval);
    }, [endTime]);

    const handleSet = () => {
        const min = parseInt(input);
        if (!isNaN(min) && min > 0) {
            onSetMinutes(min);
            setInput('');
        }
    };

    return (
        <TileWrapper title={title} defaultSpan={defaultSpan} onSpanChange={onSpanChange}>
            <Stack>
                <Text ta="center">Restzeit: {remaining}</Text>
                <TextInput
                    placeholder="Minuten eingeben"
                    value={input}
                    onChange={(e) => setInput(e.currentTarget.value)}
                    inputMode="numeric"
                    pattern="[0-9]*"
                />
                <Button onClick={handleSet}>Klausurzeit setzen</Button>
            </Stack>
        </TileWrapper>
    );
}
