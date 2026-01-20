// src/components/TileWrapper.tsx
import React, { ReactNode, useState } from 'react';
import { ActionIcon, Card, Collapse, Group, Stack, Text, useMantineTheme } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconMinus, IconPlus, IconChevronDown, IconChevronUp, IconX } from "@tabler/icons-react";

interface TileWrapperProps {
    title: string;
    children: ReactNode;
    defaultSpan?: number;
    onSpanChange?: (span: number) => void;
    headerActions?: ReactNode;
    secondaryHeaderActions?: ReactNode;
    cardStyle?: React.CSSProperties;
    onClose?: () => void;
}

export function TileWrapper({
                                title,
                                children,
                                defaultSpan = 4,
                                onSpanChange,
                                headerActions,
                                secondaryHeaderActions,
                                cardStyle,
                                onClose,
                            }: TileWrapperProps) {
    const [collapsed, setCollapsed] = useState(false);
    const [span, setSpan] = useState(defaultSpan);
    const theme = useMantineTheme();
    const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);

    const changeSpan = (delta: number) => {
        const newSpan = Math.min(6, Math.max(1, span + delta));
        setSpan(newSpan);
        onSpanChange?.(newSpan);
    };

    return (
        <Card
            shadow="sm"
            radius="md"
            withBorder
            style={{ gridColumn: `span ${isMobile ? 1 : span}`, ...cardStyle }}
        >
            <Stack gap={4} mb="xs">
                <Group justify="space-between">
                    <Text fw={500}>{title}</Text>
                    <Group gap="xs">
                        {!isMobile && (
                            <>
                                <ActionIcon onClick={() => changeSpan(-1)} variant="light">
                                    <IconMinus size={16} />
                                </ActionIcon>
                                <ActionIcon onClick={() => changeSpan(1)} variant="light">
                                    <IconPlus size={16} />
                                </ActionIcon>
                            </>
                        )}
                        {headerActions}
                        {onClose && (
                            <ActionIcon
                                onClick={onClose}
                                variant="light"
                                color="red"
                                aria-label="Karte schließen"
                            >
                                <IconX size={16} />
                            </ActionIcon>
                        )}
                        <ActionIcon onClick={() => setCollapsed((c) => !c)} variant="light">
                            {collapsed ? <IconChevronDown size={16} /> : <IconChevronUp size={16} />}
                        </ActionIcon>
                    </Group>
                </Group>
                {secondaryHeaderActions && (
                    <Group gap="xs" justify="flex-end">
                        {secondaryHeaderActions}
                    </Group>
                )}
            </Stack>
            <Collapse in={!collapsed}>
                {children}
            </Collapse>
        </Card>

    );
}
