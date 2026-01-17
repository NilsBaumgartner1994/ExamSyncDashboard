// src/components/NotesTile.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { ActionIcon, Button, Group, Stack, Text, Textarea } from '@mantine/core';
import { IconLock, IconPencil } from '@tabler/icons-react';
import { TileWrapper } from './TileWrapper';

interface NotesTileProps {
    title: string;
    text: string;
    lockedBy: string | null;
    lockedByName: string | null;
    myPeerId?: string;
    onRequestLock: () => void;
    onForceLock: () => void;
    onSave: (nextText: string) => void;
    defaultSpan?: number;
    onSpanChange?: (span: number) => void;
}

export function NotesTile({
                              title,
                              text,
                              lockedBy,
                              lockedByName,
                              myPeerId,
                              onRequestLock,
                              onForceLock,
                              onSave,
                              defaultSpan = 3,
                              onSpanChange,
                          }: NotesTileProps) {
    const [draft, setDraft] = useState(text);

    const isLockedByMe = lockedBy && myPeerId && lockedBy === myPeerId;
    const isLockedByOther = lockedBy && (!myPeerId || lockedBy !== myPeerId);

    useEffect(() => {
        if (!isLockedByMe) {
            setDraft(text);
        }
    }, [text, isLockedByMe]);

    const headerActions = useMemo(() => {
        if (isLockedByOther) {
            return (
                <ActionIcon
                    variant="light"
                    color="red"
                    onClick={onForceLock}
                    title="Sperre übernehmen"
                >
                    <IconLock size={16} />
                </ActionIcon>
            );
        }

        if (!lockedBy) {
            return (
                <ActionIcon variant="light" onClick={onRequestLock} title="Notizen bearbeiten">
                    <IconPencil size={16} />
                </ActionIcon>
            );
        }

        return null;
    }, [isLockedByOther, lockedBy, onForceLock, onRequestLock]);

    return (
        <TileWrapper
            title={title}
            defaultSpan={defaultSpan}
            onSpanChange={onSpanChange}
            headerActions={headerActions}
        >
            <Stack>
                {lockedBy && (
                    <Text size="xs" c={isLockedByMe ? 'green' : 'red'}>
                        {isLockedByMe
                            ? 'Du bearbeitest die Notizen.'
                            : `Gesperrt von ${lockedByName ?? 'Unbekannt'}.`}
                    </Text>
                )}
                <Textarea
                    minRows={6}
                    value={isLockedByMe ? draft : text}
                    onChange={(event) => setDraft(event.currentTarget.value)}
                    readOnly={!isLockedByMe}
                    placeholder="Gemeinsame Notizen..."
                />
                <Group justify="flex-end">
                    <Button onClick={() => onSave(draft)} disabled={!isLockedByMe}>
                        Speichern &amp; freigeben
                    </Button>
                </Group>
            </Stack>
        </TileWrapper>
    );
}
