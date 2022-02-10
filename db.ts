import sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';

// Since this is mostly to test my knowledge around Slack,
// I guess we can get away without an ORM

let __db: Database;

export interface Task {
	id: number;
	channel: string;
	ts: string;
	status_id: number;
	status: string;
	tags: string[];
}

export interface Status {
	id: number;
	name: string;
}

export enum DefaultStatus {
	New = 0,
	Completed = 1
}

async function getDB() {
	if (!__db) {
		__db = await open({
			filename: process.env.DATABASE_FILE || ':memory:',
			driver: sqlite3.Database,
		});

		await initDB(__db);
	}

	return __db;
}

async function initDB(db: Database) {
	await db.exec(`
		CREATE TABLE
		IF NOT EXISTS
		task (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			channel TEXT NOT NULL,
			ts TEXT NOT NULL,
			status_id INTEGER DEFAULT ${DefaultStatus.New} NOT NULL,
			tags TEXT DEFAULT "" NOT NULL
		)
	`);

	await db.exec(`
		CREATE TABLE
		IF NOT EXISTS
		status (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL
		)
	`);

	await db.run(`
		INSERT OR IGNORE
		INTO
		status (
			id,
			name
		)
		VALUES
			(?, "New"),
			(?, "Completed")
	`, DefaultStatus.New, DefaultStatus.Completed);
}

export async function storeTask({ channel, ts, tags }: Omit<Task, 'id' | 'status' | 'status_id'>) {
	const db = await getDB();

	await db.run(`
		INSERT INTO task (channel, ts, tags)
		VALUES (?, ?, ?)
	`, channel, ts, tags.join(','));
}

export async function getTasks(): Promise<Task[]> {
	const db = await getDB();

	const res = await db.all(`
		SELECT
			task.*,
			status.name AS status
		FROM task
		LEFT JOIN status ON task.status_id = status.id
	`);

	return res.map(({ tags, ...rest }) => ({
		tags: tags.split(','),
		...rest
	}));
}

export async function updateTaskStatus(taskId: number, statusId: number) {
	const db = await getDB();

	await db.run(`
		UPDATE task
		SET status_id = ?
		WHERE id = ?
	`, statusId, taskId);
}

export async function getStatus(): Promise<Status[]> {
	const db = await getDB();

	return await db.all<Status[]>(`
		SELECT id, name
		FROM status
	`);
}

export async function createStatus(name: string) {
	const db = await getDB();

	await db.run(`
		INSERT INTO status (name)
		VALUES (?)
	`, name);
}
