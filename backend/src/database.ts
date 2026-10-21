import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import "./config.js";

type Row = Record<string, unknown>;
type Connection = { promises: { query: (sql: string, params: unknown[]) => Promise<{ first: Row[] }>; close: () => Promise<void> } };
type Driver = { promises: { open: (connection: string) => Promise<Connection> } };
const driver = createRequire(import.meta.url)("msnodesqlv8") as Driver;
const database = process.env.DB_NAME || "KingOfChess";
if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(database)) throw new Error("Invalid DB_NAME");
if (process.env.DB_CONNECTION_STRING && !process.env.DB_CONNECTION_STRING.includes("{database}")) throw new Error("DB_CONNECTION_STRING must contain {database}");
const connection = (name: string) => process.env.DB_CONNECTION_STRING?.replaceAll("{database}", name) || `Driver={ODBC Driver 18 for SQL Server};Server=lpc:.\\SQLEXPRESS;Database=${name};Trusted_Connection=Yes;Encrypt=Yes;TrustServerCertificate=Yes;`;

export async function query<T = Row>(sql: string, params: unknown[] = [], name = database): Promise<T[]> {
    const conn = await driver.promises.open(connection(name));
    try { return (await conn.promises.query(sql, params)).first as T[] || []; }
    finally { await conn.promises.close(); }
}

export async function initializeDatabase() {
    await query(`IF DB_ID(N'${database}') IS NULL CREATE DATABASE [${database}]`, [], "master");
    const schema = await readFile(new URL("../sql/schema.sql", import.meta.url), "utf8");
    await query(schema);
    await query("DELETE FROM dbo.Sessions WHERE ExpiresAt < SYSUTCDATETIME()");
}

export async function saveRoom(room: { code: string; gameId: string; white: { id: string }; black: { id: string } | null; status: string; pgn: string; result: unknown; createdAt: number; updatedAt: number }, snapshot: string) {
    await query(`SET XACT_ABORT ON; BEGIN TRANSACTION;
UPDATE dbo.Rooms SET Snapshot=?, UpdatedAt=SYSUTCDATETIME() WHERE Code=?;
IF @@ROWCOUNT=0 INSERT dbo.Rooms(Code,Snapshot) VALUES(?,?);
UPDATE dbo.Games SET BlackId=?, Status=?, Pgn=?, Result=?, Snapshot=?, UpdatedAt=SYSUTCDATETIME() WHERE Id=?;
IF @@ROWCOUNT=0 INSERT dbo.Games(Id,RoomCode,WhiteId,BlackId,Status,Pgn,Result,Snapshot,CreatedAt) VALUES(?,?,?,?,?,?,?,?,DATEADD(second,?,CONVERT(datetime2,'1970-01-01')));
COMMIT TRANSACTION;`, [snapshot, room.code, room.code, snapshot, room.black?.id || null, room.status, room.pgn, JSON.stringify(room.result), snapshot, room.gameId, room.gameId, room.code, room.white.id, room.black?.id || null, room.status, room.pgn, JSON.stringify(room.result), snapshot, Math.floor(room.createdAt / 1000)]);
}
