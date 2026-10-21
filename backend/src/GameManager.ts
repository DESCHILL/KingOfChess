import { RoomManager, type SavedRoom } from "./RoomManager.js";
import { query, saveRoom } from "./database.js";

export const gameManager = new RoomManager({
    load: async () => (await query<{ Snapshot: string }>("SELECT Snapshot FROM dbo.Rooms")).map(row => JSON.parse(row.Snapshot) as SavedRoom),
    save: room => saveRoom(room, JSON.stringify(room)),
    remove: async code => { await query("DELETE dbo.Rooms WHERE Code=?", [code]); },
});
