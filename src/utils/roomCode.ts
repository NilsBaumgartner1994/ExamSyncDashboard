export const normalizeRoomCode = (code: string) =>
    code.replace(/\D/g, '').trim().slice(0, 6);

export const isValidRoomCode = (code: string) => /^\d{6}$/.test(code);

export const formatRoomIdForDisplay = (roomId: string) => {
    const normalized = normalizeRoomCode(roomId);
    if (!/^\d+$/.test(normalized)) return roomId;
    return normalized.replace(/(\d{3})(?=\d)/g, '$1 ');
};
