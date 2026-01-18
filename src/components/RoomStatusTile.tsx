// src/components/RoomStatusTile.tsx
import React, { Fragment, useMemo, useState } from 'react';
import { ActionIcon, Button, Divider, Group, Stack, Text, TextInput, Box } from '@mantine/core';
import { IconBell, IconCheck, IconTrash } from '@tabler/icons-react';
import { keyframes } from '@emotion/react';
import { TileWrapper } from './TileWrapper';

export interface RoomStatus {
    name: string;
    needsHelp: boolean;
    isResolved?: boolean;
}

interface RoomStatusTileProps {
    title: string;
    rooms: RoomStatus[];
    onAddRoom: (name: string) => void;
    onToggleHelp: (name: string) => void;
    onClearHelp: (name: string) => void;
    onRemoveRoom: (name: string) => void;
    defaultSpan?: number;
    onSpanChange?: (span: number) => void;
    onClose?: () => void;
}

const helpBlink = keyframes`
  0%, 100% {
    background-color: #ffd43b;
  }
  50% {
    background-color: #f1f3f5;
  }
`;

const baseBackgroundColor = '#f1f3f5';
const alertBackgroundColor = '#ffd43b';
const resolvedBackgroundColor = '#40c057';

const getContrastTextColor = (hexColor: string) => {
    const normalized = hexColor.replace('#', '');
    const red = parseInt(normalized.slice(0, 2), 16);
    const green = parseInt(normalized.slice(2, 4), 16);
    const blue = parseInt(normalized.slice(4, 6), 16);
    const [r, g, b] = [red, green, blue].map((channel) => {
        const value = channel / 255;
        return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return luminance > 0.179 ? '#000' : '#fff';
};

export function RoomStatusTile({
    title,
    rooms,
    onAddRoom,
    onToggleHelp,
    onClearHelp,
    onRemoveRoom,
    defaultSpan = 2,
    onSpanChange,
    onClose,
}: RoomStatusTileProps) {
    const [roomInput, setRoomInput] = useState('');

    const handleAdd = () => {
        const trimmed = roomInput.trim();
        if (!trimmed) return;
        onAddRoom(trimmed);
        setRoomInput('');
    };

    const roomRows = useMemo(
        () =>
            rooms.map((room, index) => {
                const isResolved = Boolean(room.isResolved);
                const backgroundColor = room.needsHelp
                    ? baseBackgroundColor
                    : isResolved
                        ? resolvedBackgroundColor
                        : baseBackgroundColor;
                const textColor = getContrastTextColor(
                    room.needsHelp ? alertBackgroundColor : backgroundColor,
                );
                const rowStyle = room.needsHelp
                    ? {
                        animation: `${helpBlink} 1s infinite`,
                        backgroundColor,
                        border: '1px solid #f0c36d',
                        color: textColor,
                    }
                    : {
                        backgroundColor,
                        border: '1px solid #dee2e6',
                        color: textColor,
                    };

                return (
                    <Fragment key={`${room.name}-${index}`}>
                        <Box
                            style={{
                                ...rowStyle,
                                borderRadius: 8,
                                padding: '8px 12px',
                            }}
                        >
                            <Group justify="space-between" wrap="nowrap">
                                <Text fw={600} style={{ flex: 1 }} c={textColor}>
                                    {room.name}
                                </Text>
                                <ActionIcon
                                    size="lg"
                                    variant={room.needsHelp ? 'filled' : 'light'}
                                    color={room.needsHelp ? 'yellow' : 'gray'}
                                    aria-label="Hilfe anfordern"
                                    onClick={() => onToggleHelp(room.name)}
                                >
                                    <IconBell size={18} />
                                </ActionIcon>
                                <Group gap="sm">
                                    <ActionIcon
                                        size="lg"
                                        variant="light"
                                        color="green"
                                        aria-label="Hilfe erledigt"
                                        onClick={() => onClearHelp(room.name)}
                                    >
                                        <IconCheck size={18} />
                                    </ActionIcon>
                                    <ActionIcon
                                        size="lg"
                                        variant="light"
                                        color="red"
                                        aria-label="Raum entfernen"
                                        onClick={() => onRemoveRoom(room.name)}
                                    >
                                        <IconTrash size={18} />
                                    </ActionIcon>
                                </Group>
                            </Group>
                        </Box>
                        {index < rooms.length - 1 && <Divider size="xs" />}
                    </Fragment>
                );
            }),
        [rooms, onToggleHelp, onClearHelp, onRemoveRoom],
    );

    return (
        <TileWrapper
            title={title}
            defaultSpan={defaultSpan}
            onSpanChange={onSpanChange}
            onClose={onClose}
        >
            <Stack>
                {rooms.length > 0 ? roomRows : (
                    <Text size="sm" c="dimmed" ta="center">
                        Noch keine Räume eingetragen.
                    </Text>
                )}
                <TextInput
                    placeholder="Raumname eingeben"
                    value={roomInput}
                    onChange={(event) => setRoomInput(event.currentTarget.value)}
                    onKeyDown={(event) => event.key === 'Enter' && handleAdd()}
                />
                <Button onClick={handleAdd} disabled={!roomInput.trim()} fullWidth>
                    Raum hinzufügen
                </Button>
            </Stack>
        </TileWrapper>
    );
}
