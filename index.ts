import 'dotenv/config';
import { App } from '@slack/bolt';
import { updateTaskStatus, storeTask, createStatus, deleteStatus } from './db';
import { republishHomeView } from './util';
import { buildStatusManagementView } from './view';

const REACTIONS_MAP: Record<string, string[]> = {
	ladybug: ['bug'],
};


export enum CustomAction {
	UpdateTaskStatus = 'update-task-status',
	DeleteStatus = 'delete-status',
	MainOverflow = 'main-overflow',
	AddStatus = 'add-status'
}

const app = new App({
	token: process.env.SLACK_BOT_TOKEN,
	signingSecret: process.env.SLACK_SIGNING_SECRET,
	appToken: process.env.SLACK_APP_TOKEN,
	socketMode: true,
	port: Number(process.env.PORT) || 3000,
});

app.event('reaction_added', async ({ event }) => {
	if (event.item.type !== 'message') {
		return;
	}

	if (!Object.keys(REACTIONS_MAP).includes(event.reaction)) {
		return;
	}

	await storeTask({
		channel: event.item.channel,
		ts: event.item.ts,
		tags: REACTIONS_MAP[event.reaction],
	});

	await republishHomeView(event.user);
});

app.event('app_home_opened', async ({ event }) => {
	if (event.tab !== 'home') {
		return;
	}

	await republishHomeView(event.user);
});

app.action(CustomAction.UpdateTaskStatus, async ({ ack, action, body }) => {
	if (action.type !== 'static_select') {
		return;
	}

	const [taskId, statusId] = action.selected_option.value.split(':');

	await updateTaskStatus(Number(taskId), Number(statusId));
	await ack();

	await republishHomeView(body.user.id);
});

app.action(CustomAction.MainOverflow, async ({ ack, action, body }) => {
	if (body.type !== 'block_actions') {
		return;
	}

	await ack();
	await app.client.views.open({
		trigger_id: body.trigger_id,
		view: await buildStatusManagementView()
	});

});

app.action(CustomAction.AddStatus, async ({ ack, action, body }) => {
	if (action.type !== 'plain_text_input') {
		return;
	}

	if (body.type !== 'block_actions') {
		return;
	}

	if (!body.view) {
		return;
	}

	await ack();
	await createStatus(action.value);

	await app.client.views.update({
		view_id: body.view.id,
		view: await buildStatusManagementView()
	});

	await republishHomeView(body.user.id);
});

app.action(CustomAction.DeleteStatus, async ({ ack, action, body }) => {
	if (action.type !== 'button') {
		return;
	}

	if (body.type !== 'block_actions') {
		return;
	}

	if (!body.view) {
		return;
	}

	await ack();
	await deleteStatus(Number(action.value));

	await app.client.views.update({
		view_id: body.view.id,
		view: await buildStatusManagementView()
	});

	await republishHomeView(body.user.id);
});

(async () => {
	await app.start();

	await republishHomeView('U26DB2A2W');

	console.log('⚡️ Channeling is running!');
})();

export default app;
