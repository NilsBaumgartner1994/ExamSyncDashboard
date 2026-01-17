export const normalizeRoomCode = (code: string) => code.trim().replace(/\s+/g, '');

export const formatRoomIdForDisplay = (roomId: string) => {
    const normalized = normalizeRoomCode(roomId);
    if (!/^\d+$/.test(normalized)) return roomId;
    return normalized.replace(/(\d{3})(?=\d)/g, '$1 ');
};
