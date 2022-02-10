import { getTasks, Task } from './db';
import app from './index';
import { buildHomeView, buildStatusManagementView } from './view';

export async function republishHomeView(user: string) {
	const tasks = await getTasks();

	await app.client.views.publish({
		user_id: user,
		view: await buildHomeView(tasks),
	});
}

export async function showModal({ triggerId, viewId } : { triggerId: string, viewId?: never } | { triggerId?: never, viewId: string }) {
	if (viewId) {
		await app.client.views.update({
			view_id: viewId,
			view: await buildStatusManagementView()
		});
	} else if (triggerId) {
		await app.client.views.open({
			trigger_id: triggerId,
			view: await buildStatusManagementView()
		});
	}
}

export async function fetchTaskData(task: Task) {
	let message, profile;

	const msgRes = await app.client.conversations.history({
		channel: task.channel,
		latest: task.ts,
		inclusive: true,
		limit: 1,
	});

	if (msgRes.messages?.length === 1) {
		message = msgRes.messages[0];

		const profRes = await app.client.users.profile.get({
			user: message.user,
		});

		if (profRes.profile) {
			profile = profRes.profile;
		}
	}

	return { message, profile };
}
