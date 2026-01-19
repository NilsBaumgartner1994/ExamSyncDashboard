// src/components/NotesTile.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActionIcon, Button, Group, Stack, Text, Textarea } from '@mantine/core';
import { IconEye, IconLock, IconPencil, IconZoomIn, IconZoomOut } from '@tabler/icons-react';
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
    const [viewMode, setViewMode] = useState<'admin' | 'exam'>('admin');
    const [draft, setDraft] = useState(text);
    const [showForcePrompt, setShowForcePrompt] = useState(false);
    const [focusOnLock, setFocusOnLock] = useState(false);
    const [examFontScale, setExamFontScale] = useState(1);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const minFontScale = 0.8;
    const maxFontScale = 1.6;
    const fontScaleStep = 0.1;

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
        const actions: React.ReactNode[] = [
            (
                <ActionIcon
                    key="view"
                    onClick={() => setViewMode((prev) => (prev === 'admin' ? 'exam' : 'admin'))}
                    variant="light"
                    aria-label="Ansicht wechseln"
                >
                    <IconEye size={16} />
                </ActionIcon>
            ),
        ];

        if (viewMode === 'admin') {
            if (isLockedByOther) {
                actions.unshift(
                    <ActionIcon
                        key="force"
                        variant="light"
                        color="red"
                        onClick={onForceLock}
                        title="Sperre übernehmen"
                    >
                        <IconLock size={16} />
                    </ActionIcon>,
                );
            } else if (!lockedBy) {
                actions.unshift(
                    <ActionIcon key="edit" variant="light" onClick={onRequestLock} title="Notizen bearbeiten">
                        <IconPencil size={16} />
                    </ActionIcon>,
                );
            }
        }

        return <Group gap="xs">{actions}</Group>;
    }, [isLockedByOther, lockedBy, onForceLock, onRequestLock, viewMode]);

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

    const updateExamFontScale = (delta: number) => {
        setExamFontScale((prev) => {
            const next = Math.min(maxFontScale, Math.max(minFontScale, prev + delta));
            return Number(next.toFixed(2));
        });
    };

    return (
        <TileWrapper
            title={title}
            defaultSpan={defaultSpan}
            onSpanChange={onSpanChange}
            headerActions={headerActions}
            onClose={onClose}
        >
            {viewMode === 'exam' ? (
                <Stack gap="xs">
                    <Text size="sm" style={{ whiteSpace: 'pre-line', fontSize: `${1 * examFontScale}em` }}>
                        {text.trim() ? text : 'Keine Notizen vorhanden.'}
                    </Text>
                    <Group gap={6} justify="flex-end" w="100%">
                        <ActionIcon
                            variant="light"
                            onClick={() => updateExamFontScale(-fontScaleStep)}
                            aria-label="Schrift verkleinern"
                            disabled={examFontScale <= minFontScale}
                        >
                            <IconZoomOut size={16} />
                        </ActionIcon>
                        <ActionIcon
                            variant="light"
                            onClick={() => updateExamFontScale(fontScaleStep)}
                            aria-label="Schrift vergrößern"
                            disabled={examFontScale >= maxFontScale}
                        >
                            <IconZoomIn size={16} />
                        </ActionIcon>
                    </Group>
                </Stack>
            ) : (
                <Stack>
                    {lockedBy && (
                        <Text size="xs" c={isLockedByMe ? 'green' : 'red'}>
                            {isLockedByMe
                                ? 'Du bearbeitest die Notizen.'
                                : `Gesperrt von ${lockedByName ?? 'Unbekannt'}.`}
                        </Text>
                    )}
                    <Textarea
                        autosize
                        minRows={6}
                        maxRows={15}
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
            )}
        </TileWrapper>
    );
}
