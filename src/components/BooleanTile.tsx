// src/components/BooleanTile.tsx
import React from 'react';
import { Button, Stack, Text } from '@mantine/core';
import { TileWrapper } from './TileWrapper';

interface BooleanTileProps {
    title: string;
    value: boolean;
    onToggle: () => void;
    onText?: string;
    offText?: string;
    defaultSpan?: number;
    onSpanChange?: (span: number) => void;
}

export function BooleanTile({
                                title,
                                value,
                                onToggle,
                                onText = 'Aktiviert',
                                offText = 'Deaktiviert',
                                defaultSpan = 2,
                                onSpanChange,
                            }: BooleanTileProps) {
    return (
        <TileWrapper title={title} defaultSpan={defaultSpan} onSpanChange={onSpanChange}>
            <Stack>
                <Text ta="center">{value ? onText : offText}</Text>
                <Button color={value ? 'red' : 'green'} onClick={onToggle} fullWidth>
                    {value ? 'Deaktivieren' : 'Aktivieren'}
                </Button>
            </Stack>
        </TileWrapper>
    );
}