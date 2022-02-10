import sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';

// Since this is mostly to test my knowledge around Slack,
// I guess we can get away without an ORM

let __db: Database;

export interface Task {
	id: number;
	channel: string;
	ts: string;
	status: string;
	tags: string[];
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
			status TEXT DEFAULT "New" NOT NULL,
			tags TEXT DEFAULT "" NOT NULL
		)
	`);
}

export async function storeTask({ channel, ts, tags }: Omit<Task, 'id' | 'status'>) {
	const db = await getDB();

	await db.run(`
		INSERT INTO task (channel, ts, tags)
		VALUES (?, ?, ?)
	`, channel, ts, tags.join(','));
}

export async function getTasks(): Promise<Task[]> {
	const db = await getDB();

	const res = await db.all(`
		SELECT *
		FROM task
	`);

	return res.map(({ tags, ...rest }) => ({
		tags: tags.split(','),
		...rest
	}));
}

export async function completeTask(id: number) {
	const db = await getDB();

	await db.run(`
		UPDATE task
		SET status = "Completed"
		WHERE id = ?
	`, id);
}
