// src/components/NotesTile.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
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
    onClose?: () => void;
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
                              onClose,
                          }: NotesTileProps) {
    const [draft, setDraft] = useState(text);
    const [showForcePrompt, setShowForcePrompt] = useState(false);
    const [focusOnLock, setFocusOnLock] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    const isLockedByMe = lockedBy && myPeerId && lockedBy === myPeerId;
    const isLockedByOther = lockedBy && (!myPeerId || lockedBy !== myPeerId);

    useEffect(() => {
        if (!isLockedByMe) {
            setDraft(text);
        }
    }, [text, isLockedByMe]);

    useEffect(() => {
        if (!isLockedByOther) {
            setShowForcePrompt(false);
        }
    }, [isLockedByOther]);

    useEffect(() => {
        if (isLockedByMe && focusOnLock) {
            textareaRef.current?.focus();
            setFocusOnLock(false);
        }
    }, [focusOnLock, isLockedByMe]);

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

    const handleTextareaClick = () => {
        if (!lockedBy) {
            setFocusOnLock(true);
            onRequestLock();
            return;
        }
        if (isLockedByOther) {
            setShowForcePrompt(true);
        }
    };

    const handleForceConfirm = () => {
        setShowForcePrompt(false);
        setFocusOnLock(true);
        onForceLock();
    };

    return (
        <TileWrapper
            title={title}
            defaultSpan={defaultSpan}
            onSpanChange={onSpanChange}
            headerActions={headerActions}
            onClose={onClose}
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
                    ref={textareaRef}
                    value={isLockedByMe ? draft : text}
                    onChange={(event) => setDraft(event.currentTarget.value)}
                    readOnly={!isLockedByMe}
                    placeholder="Gemeinsame Notizen..."
                    onClick={handleTextareaClick}
                />
                {showForcePrompt && (
                    <Stack gap="xs">
                        <Text size="xs" c="red">
                            Feld ist gesperrt von {lockedByName ?? 'Unbekannt'}. Möchten Sie force?
                        </Text>
                        <Group gap="xs">
                            <Button size="xs" color="red" onClick={handleForceConfirm}>
                                Ja
                            </Button>
                            <Button size="xs" variant="light" onClick={() => setShowForcePrompt(false)}>
                                Nein
                            </Button>
                        </Group>
                    </Stack>
                )}
                <Group justify="flex-end">
                    <Button onClick={() => onSave(draft)} disabled={!isLockedByMe}>
                        Speichern &amp; freigeben
                    </Button>
                </Group>
            </Stack>
        </TileWrapper>
    );
}
