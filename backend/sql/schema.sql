IF OBJECT_ID('dbo.Users','U') IS NULL
CREATE TABLE dbo.Users (
    Id uniqueidentifier NOT NULL PRIMARY KEY,
    Username nvarchar(40) NOT NULL UNIQUE,
    PasswordHash nvarchar(256) NULL,
    IsGuest bit NOT NULL DEFAULT 0,
    CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
);
IF OBJECT_ID('dbo.Sessions','U') IS NULL
CREATE TABLE dbo.Sessions (
    TokenHash char(64) NOT NULL PRIMARY KEY,
    UserId uniqueidentifier NOT NULL REFERENCES dbo.Users(Id),
    ExpiresAt datetime2 NOT NULL
);
IF OBJECT_ID('dbo.Rooms','U') IS NULL
CREATE TABLE dbo.Rooms (
    Code varchar(6) NOT NULL PRIMARY KEY,
    Snapshot nvarchar(max) NOT NULL,
    UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_RoomSnapshot CHECK (ISJSON(Snapshot)=1)
);
IF OBJECT_ID('dbo.Games','U') IS NULL
CREATE TABLE dbo.Games (
    Id uniqueidentifier NOT NULL PRIMARY KEY,
    RoomCode varchar(6) NOT NULL,
    WhiteId uniqueidentifier NOT NULL REFERENCES dbo.Users(Id),
    BlackId uniqueidentifier NULL REFERENCES dbo.Users(Id),
    Status varchar(16) NOT NULL,
    Pgn nvarchar(max) NOT NULL,
    Result nvarchar(256) NOT NULL,
    Snapshot nvarchar(max) NOT NULL,
    CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_GameSnapshot CHECK (ISJSON(Snapshot)=1)
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Games_White' AND object_id=OBJECT_ID('dbo.Games'))
CREATE INDEX IX_Games_White ON dbo.Games(WhiteId,CreatedAt DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Games_Black' AND object_id=OBJECT_ID('dbo.Games'))
CREATE INDEX IX_Games_Black ON dbo.Games(BlackId,CreatedAt DESC);
